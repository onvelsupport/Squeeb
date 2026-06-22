from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login as django_login
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth import logout
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
import json
import stripe

from accounts.models import Task
from .models import Product, ProductImage, TaskCompletion, FundingPayment, WithdrawalRequest


stripe.api_key = settings.STRIPE_SECRET_KEY


# ==========================
# PUBLIC PAGES
# ==========================
def homepage(request):
    return render(request, "accounts/index.html")


def login_page(request):
    return render(request, "accounts/login.html")


def signup_page(request):
    return render(request, "accounts/signup.html")


def about(request):
    return render(request, "accounts/about.html")


def forgot_password_page(request):
    return render(request, "accounts/forgot_password.html")


def marketplace_page(request):
    category = request.GET.get("category")

    if category and category != "all":
        products = Product.objects.filter(category=category, is_sold=False).order_by("-id")
    else:
        products = Product.objects.filter(is_sold=False).order_by("-id")

    return render(request, "accounts/marketplace.html", {
        "products": products,
        "active_category": category
    })


def forgot_password_api(request):
    if request.method == "POST":
        return JsonResponse({"message": "If this email exists, a reset link was sent."})

    return JsonResponse({"error": "POST method required"}, status=400)


# ==========================
# AUTH HTML + PROTECTED PAGE
# ==========================
@login_required
def dashboard(request):
    return render(request, "accounts/dashboard.html")


# ==========================
# AUTH APIs
# ==========================
@csrf_exempt
def signup(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    data = json.loads(request.body.decode("utf-8"))

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    from django.contrib.auth import get_user_model
    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    User.objects.create_user(username=username, email=email, password=password)

    return JsonResponse({"message": "User created successfully"})


@csrf_exempt
def login_user(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    data = json.loads(request.body.decode("utf-8"))

    username = data.get("username")
    password = data.get("password")

    user = authenticate(request, username=username, password=password)

    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    django_login(request, user)
    return JsonResponse({"message": "Login successful"})


@csrf_exempt
def logout_user(request):
    logout(request)
    return JsonResponse({"message": "Logged out successfully"})


# ==========================
# REAL STRIPE WALLET FUNDING
# ==========================
@csrf_exempt
@login_required
def create_funding_checkout(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        amount = Decimal(str(data.get("amount", "0")))
    except Exception:
        return JsonResponse({"error": "Invalid amount"}, status=400)

    if amount < Decimal("1.00"):
        return JsonResponse({"error": "Minimum funding amount is £1.00"}, status=400)

    payment = FundingPayment.objects.create(
        user=request.user,
        amount=amount,
        status="pending"
    )

    site_url = settings.SITE_URL

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        customer_email=request.user.email or None,
        line_items=[
            {
                "price_data": {
                    "currency": "gbp",
                    "product_data": {
                        "name": "Squeeb Wallet Funding",
                    },
                    "unit_amount": int(amount * 100),
                },
                "quantity": 1,
            }
        ],
        metadata={
            "payment_id": str(payment.id),
            "user_id": str(request.user.id),
            "purpose": "wallet_funding",
        },
        success_url=f"{site_url}/dashboard/?funding=success",
        cancel_url=f"{site_url}/dashboard/?funding=cancelled",
    )

    payment.stripe_session_id = session.id
    payment.save(update_fields=["stripe_session_id"])

    return JsonResponse({"checkout_url": session.url})


@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            endpoint_secret
        )
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session.get("id")

        try:
            with transaction.atomic():
                payment = FundingPayment.objects.select_for_update().get(
                    stripe_session_id=session_id
                )

                if payment.status != "paid":
                    user = payment.user
                    user.balance = (user.balance or Decimal("0")) + payment.amount
                    user.save(update_fields=["balance"])

                    payment.status = "paid"
                    payment.paid_at = timezone.now()
                    payment.save(update_fields=["status", "paid_at"])

        except FundingPayment.DoesNotExist:
            return HttpResponse(status=404)

    return HttpResponse(status=200)


# ==========================
# CART
# ==========================
@login_required
def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if product.seller == request.user:
        return redirect("marketplace")

    cart = request.session.get("cart", {})
    product_id = str(product_id)

    cart[product_id] = cart.get(product_id, 0) + 1

    request.session["cart"] = cart
    return redirect("marketplace")


@login_required
def remove_from_cart(request, product_id):
    cart = request.session.get("cart", {})
    product_id = str(product_id)

    if product_id in cart:
        del cart[product_id]

    request.session["cart"] = cart
    return redirect("cart_page")


@login_required
def cart_page(request):
    cart = request.session.get("cart", {})
    products = Product.objects.filter(id__in=cart.keys())
    total = sum(p.price * cart.get(str(p.id), 1) for p in products)

    return render(request, "accounts/cart.html", {
        "products": products,
        "total": total
    })


@login_required
def edit_product(request, product_id):
    if request.method == "POST":
        product_id = request.POST.get("product_id")
        product = get_object_or_404(Product, id=product_id)

        if product.seller != request.user:
            return redirect("marketplace")

        product.title = request.POST.get("title")
        product.price = request.POST.get("price")
        product.category = request.POST.get("category")
        product.description = request.POST.get("description")
        product.is_sold = True if request.POST.get("is_sold") else False
        product.save()

        files = request.FILES.getlist("images")
        for file in files:
            ProductImage.objects.create(product=product, image=file)

    return redirect("marketplace")


@login_required
def seller_history(request):
    sold_products = Product.objects.filter(seller=request.user, is_sold=True).order_by("-id")

    return render(request, "accounts/seller_history.html", {
        "products": sold_products
    })


@login_required
def mark_as_sold(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if product.seller != request.user:
        return redirect("marketplace")

    product.is_sold = True
    product.save()

    return redirect("marketplace")


# ==========================
# USER INFO
# ==========================
@login_required
def user_info(request):
    user = request.user

    return JsonResponse({
        "username": user.username,
        "followers": getattr(user, "followers", 0),
        "following": getattr(user, "following", 0),
        "balance": str(user.balance),
        "earnings": str(user.earnings),
        "tasks_completed": user.tasks_completed,
        "referrals": user.referrals,
        "is_member": user.is_member,
        "referral_link": f"{settings.SITE_URL}/signup/?ref={user.username}"
    })


# ==========================
# WITHDRAWAL
# ==========================
@csrf_exempt
@login_required
def request_withdrawal(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        amount = Decimal(str(data.get("amount", "0")))
        sort_code = data.get("sort_code", "").strip()
        account_number = data.get("account_number", "").strip()
    except Exception:
        return JsonResponse({"error": "Invalid withdrawal request."}, status=400)

    if amount < Decimal("5.00"):
        return JsonResponse({"error": "Minimum withdrawal amount is £5.00."}, status=400)

    if not sort_code or not account_number:
        return JsonResponse({"error": "Bank details are required."}, status=400)

    with transaction.atomic():
        from django.contrib.auth import get_user_model
        User = get_user_model()

        user = User.objects.select_for_update().get(id=request.user.id)

        if user.balance < amount:
            return JsonResponse({"error": "Insufficient balance."}, status=400)

        user.balance -= amount
        user.save(update_fields=["balance"])

        withdrawal = WithdrawalRequest.objects.create(
            user=user,
            amount=amount,
            sort_code=sort_code,
            account_number=account_number,
            status="pending"
        )

    return JsonResponse({
        "message": "Withdrawal request submitted. It will be reviewed manually.",
        "new_balance": str(user.balance),
        "withdrawal_id": withdrawal.id
    })


# ==========================
# SELL PRODUCT
# ==========================
@csrf_exempt
@login_required
def sell_product(request):
    if request.method == "POST":
        product = Product.objects.create(
            seller=request.user,
            title=request.POST["title"],
            price=request.POST["price"],
            description=request.POST["description"],
            category=request.POST["category"],
        )

        files = request.FILES.getlist("images")

        for file in files:
            ProductImage.objects.create(product=product, image=file)

        return redirect("marketplace")

    return render(request, "accounts/sell.html")


# ==========================
# DELETE PRODUCT
# ==========================
@login_required
def delete_product(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if product.seller != request.user:
        return redirect("marketplace")

    product.delete()
    return redirect("marketplace")


# ==========================
# TASK APIs
# ==========================
@login_required
def get_tasks(request):
    if not request.user.is_member:
        return JsonResponse({"error": "Membership required to access tasks."}, status=403)

    tasks = Task.objects.filter(available__gt=0)
    tasks = tasks.exclude(creator=request.user)

    completed_task_ids = TaskCompletion.objects.filter(
        user=request.user
    ).values_list("task_id", flat=True)

    tasks = tasks.exclude(id__in=completed_task_ids)

    data = [
        {
            "id": task.id,
            "title": task.title,
            "payout": str(task.worker_reward),
            "available": task.available,
            "icon": task.icon,
            "instructions": task.instructions,
            "short_desc": task.short_desc,
            "platforms": task.platforms,
            "task_type": task.task_type,
        }
        for task in tasks
    ]

    return JsonResponse({"tasks": data})


@login_required
def get_single_task(request, task_id):
    if not request.user.is_member:
        return JsonResponse({"error": "Membership required."}, status=403)

    task = get_object_or_404(Task, id=task_id)

    return JsonResponse({
        "id": task.id,
        "title": task.title,
        "payout": str(task.worker_reward),
        "available": task.available,
        "platform": task.platforms,
        "task_type": task.get_task_type_display(),
        "instructions": task.dynamic_instructions,
        "link": task.link
    })


@csrf_exempt
@login_required
def create_task(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8"))

        platform = data.get("platform")
        followers = int(data.get("followers"))
        link = data.get("link")
        task_type = data.get("task_type")

        if not task_type:
            return JsonResponse({"error": "Task type is required."}, status=400)

    except Exception:
        return JsonResponse({"error": "Invalid data"}, status=400)

    pricing = {
        "follow": {"cost": Decimal("0.15"), "reward": Decimal("0.10")},
        "like": {"cost": Decimal("0.07"), "reward": Decimal("0.05")},
        "comment": {"cost": Decimal("0.60"), "reward": Decimal("0.40")},
        "subscribe": {"cost": Decimal("0.20"), "reward": Decimal("0.10")},
    }

    task_pricing = pricing.get(task_type)

    if not task_pricing:
        return JsonResponse({"error": "Invalid task type"}, status=400)

    cost_per_action = task_pricing["cost"]
    worker_reward = task_pricing["reward"]
    total_cost = cost_per_action * followers

    user = request.user

    if user.balance < total_cost:
        return JsonResponse({"error": "Insufficient balance"}, status=400)

    user.balance -= total_cost
    user.save(update_fields=["balance"])

    Task.objects.create(
        creator=user,
        title=f"{platform} {task_type.capitalize()} Task",
        cost_per_action=cost_per_action,
        worker_reward=worker_reward,
        available=followers,
        platforms=platform,
        link=link,
        short_desc="Complete the task and earn.",
        total_budget=total_cost,
        task_type=task_type
    )

    return JsonResponse({
        "message": "Task created successfully",
        "new_balance": str(user.balance)
    })


@csrf_exempt
@login_required
def complete_task(request, task_id):
    if not request.user.is_member:
        return JsonResponse({"error": "Membership required."}, status=403)

    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    task = get_object_or_404(Task, id=task_id)

    if task.creator == request.user:
        return JsonResponse({"error": "You cannot complete your own task"}, status=400)

    if TaskCompletion.objects.filter(user=request.user, task=task).exists():
        return JsonResponse({"error": "You already completed this task"}, status=400)

    if task.available <= 0:
        return JsonResponse({"error": "No slots remaining"}, status=400)

    task.available -= 1
    task.save(update_fields=["available"])

    TaskCompletion.objects.create(user=request.user, task=task)

    request.user.balance += task.worker_reward
    request.user.earnings += task.worker_reward
    request.user.tasks_completed += 1
    request.user.save(update_fields=["balance", "tasks_completed", "earnings"])

    return JsonResponse({
        "message": "Task completed!",
        "new_balance": str(request.user.balance)
    })


# ==========================
# MEMBERSHIP PAYMENT
# ==========================
@csrf_exempt
@login_required
def pay_membership(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    membership_fee = Decimal("10.00")
    user = request.user

    if user.is_member:
        return JsonResponse({"error": "Already a member."}, status=400)

    if user.balance < membership_fee:
        return JsonResponse({"error": "Insufficient balance."}, status=400)

    user.balance -= membership_fee
    user.is_member = True
    user.save(update_fields=["balance", "is_member"])

    return JsonResponse({
        "message": "Membership activated!",
        "new_balance": str(user.balance),
        "is_member": True
    })


@login_required
def more_page(request):
    return render(request, "accounts/more.html")

@login_required
def earnings(request):
    return render(request, "accounts/earnings.html")