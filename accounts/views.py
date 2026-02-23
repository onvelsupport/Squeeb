from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login as django_login
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth import logout
from accounts.models import Task
from decimal import Decimal
from .models import Product, ProductImage, TaskCompletion

from django.contrib import messages
import json




# ==========================
# PUBLIC PAGES
# ==========================
def homepage(request):
    return render(request, "index.html")

def login_page(request):
    return render(request, "login.html")

def signup_page(request):
    return render(request, "signup.html")

def about(request):
    return render(request, "about.html")

def forgot_password_page(request):
    return render(request, "forgot_password.html")

def marketplace_page(request):
    category = request.GET.get("category")

    if category and category != "all":
        products = Product.objects.filter(
            category=category,
            is_sold=False
        ).order_by("-id")
    else:
        products = Product.objects.filter(
            is_sold=False
        ).order_by("-id")

    return render(request, "marketplace.html", {
        "products": products,
        "active_category": category
    })






def forgot_password_api(request):
    if request.method == "POST":
        import json
        data = json.loads(request.body)

        email = data.get("email")

        # TODO: send email logic
        # e.g., EmailMessage("reset", "Here is your reset link...", ...)
        
        return JsonResponse({"message": "If this email exists, a reset link was sent."})
    
# ==========================
# AUTH HTML + PROTECTED PAGE
# ==========================
@login_required
def dashboard(request):
    return render(request, "dashboard.html")


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

    # CREATE USER
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

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
# CART
# ==========================
@login_required
def add_to_cart(request, product_id):
    p = get_object_or_404(Product, id=product_id)

    # 🚫 STOP seller from buying own item
    if p.seller == request.user:
        return redirect("marketplace")

    cart = request.session.get("cart", {})
    product_id = str(product_id)

    if product_id in cart:
        cart[product_id] += 1
    else:
        cart[product_id] = 1

    request.session["cart"] = cart

    return redirect("marketplace")



@login_required
def remove_from_cart(request, product_id):
    cart = request.session.get("cart", {})
    product_id = str(product_id)  # session keys are strings

    if product_id in cart:
        del cart[product_id]

    request.session["cart"] = cart
    return redirect("cart_page")



@login_required
def cart_page(request):
    cart = request.session.get("cart", [])

    products = Product.objects.filter(id__in=cart)

    # calculate total
    total = sum(p.price for p in products)

    return render(request, "cart.html", {
        "products": products,
        "total": total
    })

@login_required
def edit_product(request, product_id):
    if request.method == "POST":
        product_id = request.POST.get("product_id")
        p = get_object_or_404(Product, id=product_id)

        if p.seller != request.user:
            return redirect("marketplace")

        p.title = request.POST.get("title")
        p.price = request.POST.get("price")
        p.category = request.POST.get("category")
        p.description = request.POST.get("description")

        p.is_sold = True if request.POST.get("is_sold") else False
        p.save()

        files = request.FILES.getlist("images")
        for f in files:
            ProductImage.objects.create(product=p, image=f)

    return redirect("marketplace")


@login_required
def seller_history(request):
    sold_products = Product.objects.filter(
        seller=request.user,
        is_sold=True
    ).order_by("-id")

    return render(request, "seller_history.html", {
        "products": sold_products
    })


@login_required
def mark_as_sold(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    # security → only seller can mark sold
    if product.seller != request.user:
        return redirect("marketplace")

    product.is_sold = True
    product.save()

    return redirect("marketplace")





# ==========================
# USER INFO (DASHBOARD)
# ==========================
@login_required
def user_info(request):
    user = request.user

    return JsonResponse({
        "username": user.username,

        # default values until wallet system is implemented
        "followers": getattr(user, "followers", 0),
        "following": getattr(user, "following", 0),
        "balance": str(user.balance),
        "earnings": str(user.earnings),

        "tasks_completed": user.tasks_completed,
        "referrals": user.referrals,
        "is_member": user.is_member,

        "referral_link": f"http://127.0.0.1:8000/signup/?ref={user.username}"
    })

@csrf_exempt
@login_required
def demo_fund(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        amount = Decimal(str(data.get("amount", "0")))
    except Exception:
        return JsonResponse({"error": "Invalid JSON/amount"}, status=400)

    if amount <= 0:
        return JsonResponse({"error": "Amount must be greater than 0"}, status=400)

    # Make sure your user model has a 'balance' field
    if not hasattr(request.user, "balance"):
        return JsonResponse({"error": "User model has no 'balance' field yet"}, status=500)

    request.user.balance = (request.user.balance or Decimal("0")) + amount
    request.user.save(update_fields=["balance"])

    return JsonResponse({"message": "Demo funded", "balance": str(request.user.balance)})


@csrf_exempt
@login_required
def demo_withdraw(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        amount = Decimal(str(data.get("amount", "0")))
        sort_code = str(data.get("sort_code", "")).strip()
        account_number = str(data.get("account_number", "")).strip()
    except Exception:
        return JsonResponse({"error": "Invalid JSON/amount"}, status=400)

    if amount <= 0:
        return JsonResponse({"error": "Amount must be greater than 0"}, status=400)

    # UK sort code: 6 digits (allow 12-34-56 or 123456)
    sc_digits = "".join(ch for ch in sort_code if ch.isdigit())
    if len(sc_digits) != 6:
        return JsonResponse({"error": "Sort code must be 6 digits (e.g. 12-34-56)."}, status=400)

    # UK account number: 8 digits
    if not account_number.isdigit() or len(account_number) != 8:
        return JsonResponse({"error": "Account number must be 8 digits."}, status=400)

    user = request.user

    if user.balance < amount:
        return JsonResponse({"error": "Insufficient balance."}, status=400)

    # DEMO: deduct balance (no real payout)
    user.balance = user.balance - amount
    user.save(update_fields=["balance"])

    return JsonResponse({
        "message": "Withdrawn (demo)",
        "balance": str(user.balance),
        "sort_code": f"{sc_digits[0:2]}-{sc_digits[2:4]}-{sc_digits[4:6]}",
        "account_number": account_number[-4:].rjust(8, "*")  # mask for safety
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

        for f in files:
            ProductImage.objects.create(product=product, image=f)

        return redirect("marketplace")

    return render(request, "sell.html")



# ==========================
# DELETE PRODUCT
# ==========================
@login_required
def delete_product(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    # security → only seller can delete
    if product.seller != request.user:
        return redirect("marketplace")

    product.delete()
    return redirect("marketplace")




# ==========================
# TASK APIs
# ==========================


@login_required
def get_tasks(request):

    # 🔒 Block non-members
    if not request.user.is_member:
        return JsonResponse({
            "error": "Membership required to access tasks."
        }, status=403)

    # 1️⃣ Get tasks that still have availability
    tasks = Task.objects.filter(available__gt=0)

    # 2️⃣ Exclude tasks created by this user
    tasks = tasks.exclude(creator=request.user)

    # 3️⃣ Exclude tasks already completed by this user
    completed_task_ids = TaskCompletion.objects.filter(
        user=request.user
    ).values_list("task_id", flat=True)

    tasks = tasks.exclude(id__in=completed_task_ids)

    data = [
        {
            "id": t.id,
            "title": t.title,
            "payout": str(t.payout),
            "available": t.available,
            "icon": t.icon,
            "instructions": t.instructions,
            "short_desc": t.short_desc,
            "platforms": t.platforms,
            "task_type": t.task_type,
        }
        for t in tasks
    ]

    return JsonResponse({"tasks": data})


# ==========================
# CREATE TASK (POST FROM FORM)
# ==========================
@login_required
def get_single_task(request, task_id):

    # 🔒 Block non-members
    if not request.user.is_member:
        return JsonResponse({
            "error": "Membership required."
        }, status=403)
    
    try:
        task = Task.objects.get(id=task_id)
    except Task.DoesNotExist:
        return JsonResponse({"error": "Task not found"}, status=404)

    # Dynamic instructions
    if task.task_type == "like":
        instructions = [
            f"Click the link below.",
            f"Like the post on {task.platforms}.",
            "Take a screenshot as proof."
        ]

    elif task.task_type == "follow":
        instructions = [
            "Click the link below.",
            f"Follow the page on {task.platforms}.",
            "Take a screenshot showing you followed."
        ]

    elif task.task_type == "comment":
        instructions = [
            "Click the link below.",
            f"Leave a genuine comment on the post.",
            "Take a screenshot of your comment."
        ]

    elif task.task_type == "subscribe":
        instructions = [
            "Click the link below.",
            "Subscribe to the channel.",
            "Take a screenshot as proof."
        ]

    else:
        instructions = [task.instructions]

    return JsonResponse({
        "id": task.id,
        "title": task.title,
        "payout": task.payout,
        "available": task.available,
        "platform": task.platforms,
        "task_type": task.get_task_type_display(),
        "instructions": instructions,
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

    except Exception:
        return JsonResponse({"error": "Invalid data"}, status=400)

    payout_per_action = Decimal("5.00")
    total_cost = payout_per_action * followers

    user = request.user

    # ✅ CHECK BALANCE
    if user.balance < total_cost:
        return JsonResponse({"error": "Insufficient balance"}, status=400)

    # ✅ DEDUCT BALANCE
    user.balance -= total_cost
    user.save(update_fields=["balance"])

    # ✅ CREATE TASK
    Task.objects.create(
        creator=user,  # make sure this field exists in model
        title=f"{platform} Followers Task",
        payout=payout_per_action,
        available=followers,
        platforms=platform,
        link=link,
        short_desc="Follow the page and earn.",
        total_budget=total_cost
    )

    return JsonResponse({
        "message": "Task created successfully",
        "new_balance": str(user.balance)
    })

@csrf_exempt
@login_required
def complete_task(request, task_id):

    # 🔒 Block non-members
    if not request.user.is_member:
        return JsonResponse({
            "error": "Membership required."
        }, status=403)

    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    task = get_object_or_404(Task, id=task_id)

    # 🚫 Creator cannot complete own task
    if task.creator == request.user:
        return JsonResponse({"error": "You cannot complete your own task"}, status=400)

    # 🚫 Already completed
    if TaskCompletion.objects.filter(user=request.user, task=task).exists():
        return JsonResponse({"error": "You already completed this task"}, status=400)

    if task.available <= 0:
        return JsonResponse({"error": "No slots remaining"}, status=400)

    # ✅ Reduce availability
    task.available -= 1
    task.save(update_fields=["available"])

    # ✅ Record completion
    TaskCompletion.objects.create(user=request.user, task=task)

    # ✅ Pay user
    request.user.balance += task.payout
    request.user.tasks_completed += 1
    request.user.earnings += task.payout
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
    return render(request, "more.html")


def earnings(request):
    return render(request, "earnings.html")

