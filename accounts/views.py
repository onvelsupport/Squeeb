import json
from decimal import Decimal

import stripe

from django.conf import settings
from django.contrib.auth import (
    authenticate,
    get_user_model,
    login as django_login,
    logout,
)
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMultiAlternatives, send_mail
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.models import Task

from .models import (
    Follow,
    FundingPayment,
    Notification,
    Product,
    ProductImage,
    ProductMessage,
    RecentActivity,
    TaskCompletion,
    WithdrawalRequest,
    Referral,
)

User = get_user_model()

def root_redirect(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return redirect("home")

@login_required
def edit_profile(request):
    return render(request, "accounts/dashboard/edit_profile.html")


@login_required
def bank_details(request):
    return render(request, "accounts/dashboard/bank_details.html")

@login_required
def my_tasks(request):
    return render(request, "accounts/dashboard/my_tasks.html")

@login_required
def my_tasks_api(request):
    tasks = Task.objects.filter(
        creator=request.user
    ).order_by("-id")

    data = []

    for task in tasks:
        data.append({
            "id": task.id,
            "title": task.title,
            "platform": task.platforms,
            "task_type": task.get_task_type_display(),
            "available": task.available,
            "budget": str(task.total_budget),
            "reward": str(task.worker_reward),
            "status": "Completed" if task.available == 0 else "Active",
            "link": task.link,
        })

    return JsonResponse({
        "tasks": data,
        "total": tasks.count(),
        "active": tasks.filter(available__gt=0).count(),
        "completed": tasks.filter(available=0).count(),
    })



def privacy_policy(request):
    return render(request, "accounts/legal/privacy.html")

@login_required
def referrals_page(request):
    return render(request, "accounts/dashboard/referrals.html")

@login_required
def referrals_api(request):
    referrals = Referral.objects.filter(
        referrer=request.user
    ).order_by("-created_at")

    total_referrals = referrals.count()
    successful_referrals = referrals.filter(rewarded=True).count()
    pending_referrals = referrals.filter(rewarded=False).count()

    total_earned = sum(ref.reward for ref in referrals if ref.rewarded)

    referral_link = request.build_absolute_uri(
        f"/signup/?ref={request.user.referral_code}"
    )

    data = []

    for referral in referrals:
        data.append({
            "username": referral.referred_user.username,
            "rewarded": referral.rewarded,
            "reward": str(referral.reward),
            "created_at": referral.created_at.strftime("%d %b %Y"),
        })

    return JsonResponse({
        "code": request.user.referral_code,
        "link": referral_link,
        "total_referrals": total_referrals,
        "successful_referrals": successful_referrals,
        "pending_referrals": pending_referrals,
        "total_earned": str(total_earned),
        "referrals": data
    })

def terms_conditions(request):
    return render(request, "accounts/legal/terms.html")


def refund_policy(request):
    return render(request, "accounts/legal/refund.html")


def cookie_policy(request):
    return render(request, "accounts/legal/cookies.html")


def acceptable_use(request):
    return render(request, "accounts/legal/acceptable_use.html")



def recent_activities_api(request):
    activities = RecentActivity.objects.all()[:10]

    data = []

    for activity in activities:
        data.append({
            "username": activity.username,
            "platform": activity.platform,
            "message": activity.message,
            "amount": str(activity.amount),
        })

    return JsonResponse({
        "activities": data
    })

@login_required
def public_user_profile(request, username):
    profile_user = get_object_or_404(User, username=username)

    products = Product.objects.filter(
        seller=profile_user,
        is_sold=False
    ).order_by("-id")

    is_following = Follow.objects.filter(
        follower=request.user,
        following=profile_user
    ).exists()

    followers_count = Follow.objects.filter(following=profile_user).count()
    following_count = Follow.objects.filter(follower=profile_user).count()

    return render(request, "accounts/profile/public_profile.html", {
        "profile_user": profile_user,
        "products": products,
        "is_following": is_following,
        "followers_count": followers_count,
        "following_count": following_count,
    })


def notifications(request):
    return render(request, "accounts/notifications/notifications.html")


@login_required
def notifications_api(request):
    notifications = Notification.objects.filter(
        user=request.user
    ).order_by("-created_at")[:20]

    data = []

    for notification in notifications:
        data.append({
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "link": notification.link,
            "is_read": notification.is_read,
            "created_at": notification.created_at.strftime("%d %b %Y, %I:%M %p"),
        })

    return JsonResponse({
        "notifications": data,
        "unread_count": Notification.objects.filter(
            user=request.user,
            is_read=False
        ).count()
    })

@csrf_exempt
@login_required
def toggle_follow(request, username):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    profile_user = get_object_or_404(User, username=username)

    if profile_user == request.user:
        return JsonResponse({"error": "You cannot follow yourself."}, status=400)

    follow, created = Follow.objects.get_or_create(
        follower=request.user,
        following=profile_user
    )

    if not created:
        follow.delete()
        is_following = False
    else:
        is_following = True

        Notification.objects.create(
            user=profile_user,
            title="New Follower",
            message=f"{request.user.username} started following you.",
            link=reverse("public_user_profile", args=[request.user.username])
        )
        

    return JsonResponse({
        "is_following": is_following,
        "followers_count": Follow.objects.filter(following=profile_user).count(),
        "following_count": Follow.objects.filter(follower=profile_user).count(),
    })

def create_notification(user, title, message):
    Notification.objects.create(
        user=user,
        title=title,
        message=message
    )



from django.views.decorators.http import require_POST

@login_required
@require_POST
def mark_notifications_read(request):
    Notification.objects.filter(
        user=request.user,
        is_read=False
    ).update(is_read=True)

    return JsonResponse({
        "success": True
    })

stripe.api_key = settings.STRIPE_SECRET_KEY



def global_search(request):

    q = request.GET.get("q", "")

    results = []

    # Users
    users = User.objects.filter(username__icontains=q)[:5]

    for user in users:
        results.append({
            "name": user.username,
            "type": "User",
            "url": f"/user/{user.username}/"
        })

    # Products
    products = Product.objects.filter(title__icontains=q)[:5]

    for p in products:
        results.append({
            "name": p.title,
            "type": "Product",
            "url": "/market/"
        })

    # Tasks
    tasks = Task.objects.filter(title__icontains=q)[:5]

    for task in tasks:
        results.append({
            "name": task.title,
            "type": "Task",
            "url": "/earnings/"
        })

    return JsonResponse({
        "results": results
    })

# ==========================
# PUBLIC PAGES
# ==========================
def homepage(request):
    return render(request, "accounts/home/home.html")


def login_page(request):
    return render(request, "accounts/auth/login.html")


def signup_page(request):
    return render(request, "accounts/auth/signup.html")


def about(request):
    return render(request, "accounts/home/about.html")

def support_page(request):
    return render(request, "accounts/support.html")

def forgot_password_page(request):
    return render(request, "accounts/auth/forgot_password.html")

@login_required
def marketplace_page(request):
    category = request.GET.get("category")

    if category and category != "all":
        products = Product.objects.filter(category=category, is_sold=False).order_by("-id")
    else:
        products = Product.objects.filter(is_sold=False).order_by("-id")

    return render(request, "accounts/marketplace/marketplace.html", {
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
    notification_count = Notification.objects.filter(
        user=request.user,
        is_read=False
    ).count()

    context = {
        "notification_count": notification_count,
    }

    return render(request, "accounts/dashboard/dashboard.html", context)

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
    referral_code = data.get("referral_code") or request.GET.get("ref")

    from django.contrib.auth import get_user_model
    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already exists"}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    if referral_code:
        try:
            referrer = User.objects.get(referral_code=referral_code)

            if referrer != user:
                Referral.objects.get_or_create(
                    referrer=referrer,
                    referred_user=user,
                    defaults={
                        "code": referral_code
                    }
                )

                referrer.referrals += 1
                referrer.save()

                Notification.objects.create(
                    user=referrer,
                    title="New Referral",
                    message=f"{user.username} joined SQUEEB using your referral link."
                )

        except User.DoesNotExist:
            pass

    return JsonResponse({
        "message": "User created successfully"
    })


@csrf_exempt
def login_user(request):
    if request.method != "POST":
        return JsonResponse({
            "success": False,
            "message": "POST method required"
        }, status=400)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid request data"
        }, status=400)

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return JsonResponse({
            "success": False,
            "message": "Username and password are required"
        }, status=400)

    user = authenticate(request, username=username, password=password)

    if user is None:
        return JsonResponse({
            "success": False,
            "message": "Invalid username or password"
        }, status=401)

    if not user.is_active:
        return JsonResponse({
            "success": False,
            "message": "This account is inactive"
        }, status=403)

    django_login(request, user)
    request.session.save()  # 👈 force session to persist

    return JsonResponse({
        "success": True,
        "message": "Login successful",
        "redirect_url": "/dashboard/"
    })


@csrf_exempt
def logout_user(request):
    logout(request)

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return JsonResponse({
            "success": True,
            "message": "Logged out successfully",
            "redirect_url": "/login/"
        })

    return redirect("login")

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

    try:
        payment = FundingPayment.objects.create(
            user=request.user,
            amount=amount,
            status="pending"
        )

        site_url = getattr(settings, "SITE_URL", "https://squeeb.co.uk").rstrip("/")

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

        return JsonResponse({
            "checkout_url": session.url
        })

    except Exception as e:
        return JsonResponse({
            "error": str(e)
        }, status=500)



@login_required
def transaction_history(request):
    return render(request, "accounts/dashboard/transaction_history.html")


@login_required
def transaction_history_api(request):
    transactions = []

    # Wallet funding / deposits
    for payment in FundingPayment.objects.filter(user=request.user):
        transactions.append({
            "type": "Deposit",
            "amount": str(payment.amount),
            "status": payment.status,
            "date": payment.created_at.strftime("%d %b %Y, %I:%M %p"),
        })

    # Withdrawals
    for withdrawal in WithdrawalRequest.objects.filter(user=request.user):
        transactions.append({
            "type": "Withdrawal",
            "amount": str(withdrawal.amount),
            "status": withdrawal.status,
            "date": withdrawal.created_at.strftime("%d %b %Y, %I:%M %p"),
        })

    transactions.sort(key=lambda x: x["date"], reverse=True)

    return JsonResponse({
        "transactions": transactions
    })

@csrf_exempt
@login_required
def api_edit_profile(request):
    if request.method != "POST":
        return JsonResponse({
            "success": False,
            "message": "POST request required."
        }, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")

        user = request.user

        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        phone_number = data.get("phone_number", "").strip()
        city = data.get("city", "").strip()

        if not username:
            return JsonResponse({
                "success": False,
                "message": "Username is required."
            }, status=400)

        # Check username uniqueness
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            return JsonResponse({
                "success": False,
                "message": "Username already exists."
            }, status=400)

        # Check email uniqueness
        if email and User.objects.filter(email=email).exclude(id=user.id).exists():
            return JsonResponse({
                "success": False,
                "message": "Email address is already in use."
            }, status=400)

        user.first_name = first_name
        user.last_name = last_name
        user.username = username
        user.email = email

        if hasattr(user, "phone_number"):
            user.phone_number = phone_number

        if hasattr(user, "city"):
            user.city = city

        user.save()

        return JsonResponse({
            "success": True,
            "message": "Profile updated successfully."
        })

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)

    except Exception as e:
        print("EDIT PROFILE ERROR:", e)

        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
    


@csrf_exempt
@login_required
def create_cart_checkout(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    cart = request.session.get("cart", {})

    if not cart:
        return JsonResponse({"error": "Your cart is empty."}, status=400)

    product_ids = cart.keys()
    products = Product.objects.filter(id__in=product_ids, is_sold=False)

    line_items = []

    for product in products:
        quantity = cart.get(str(product.id), 1)

        line_items.append({
            "price_data": {
                "currency": "gbp",
                "product_data": {
                    "name": product.title,
                },
                "unit_amount": int(product.price * 100),
            },
            "quantity": int(quantity),
        })

    site_url = settings.SITE_URL.rstrip("/")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        customer_email=request.user.email or None,
        line_items=line_items,
        metadata={
            "user_id": str(request.user.id),
            "purpose": "marketplace_cart",
        },
        success_url=f"{site_url}/cart/?checkout=success",
        cancel_url=f"{site_url}/cart/?checkout=cancelled",
    )

    return JsonResponse({
        "checkout_url": session.url
    })


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
    request.session.modified = True

    return redirect("cart")


@login_required
def cart_page(request):
    cart = request.session.get("cart", {})

    product_ids = cart.keys()
    cart_products = Product.objects.filter(id__in=product_ids)

    total_price = sum(
        product.price * cart.get(str(product.id), 0)
        for product in cart_products
    )

    return render(request, "accounts/marketplace/cart.html", {
        "cart_products": cart_products,
        "cart": cart,
        "total_price": total_price,
    })


@login_required
def remove_from_cart(request, product_id):
    cart = request.session.get("cart", {})
    product_id = str(product_id)

    if product_id in cart:
        del cart[product_id]

    request.session["cart"] = cart
    request.session.modified = True

    return redirect("cart")


@login_required
def edit_product(request, product_id):
    product = get_object_or_404(Product, id=product_id, seller=request.user)

    if request.method == "POST":
        product.title = request.POST.get("title")
        product.price = request.POST.get("price")
        product.category = request.POST.get("category")
        product.description = request.POST.get("description")
        product.is_sold = request.POST.get("is_sold") == "on"
        product.save()

        images = request.FILES.getlist("images")

        for image in images:
            ProductImage.objects.create(product=product, image=image)

        return redirect("marketplace")

    return render(request, "accounts/marketplace/edit_product.html", {
        "product": product
    })


@login_required
def product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    related_products = Product.objects.filter(
        category=product.category,
        is_sold=False
    ).exclude(id=product.id)[:4]

    return render(
        request,
        "accounts/marketplace/product_detail.html",
        {
            "product": product,
            "related_products": related_products,
        }
    )

@login_required
def send_product_message(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if request.user == product.seller:
        return redirect("product_detail", product_id=product.id)

    if request.method == "POST":
        message = request.POST.get("message")

        ProductMessage.objects.create(
            product=product,
            sender=request.user,
            receiver=product.seller,
            message=message
        )

        return redirect("product_detail", product_id=product.id)

    return redirect("product_detail", product_id=product.id)


@login_required
def seller_history(request):
    sold_products = Product.objects.filter(seller=request.user, is_sold=True).order_by("-id")

    return render(request, "accounts/marketplace/seller_history.html", {
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
from .models import Follow

@login_required
def user_info(request):

    followers_count = Follow.objects.filter(
        following=request.user
    ).count()

    following_count = Follow.objects.filter(
        follower=request.user
    ).count()

    return JsonResponse({
        "username": request.user.username,
        "balance": request.user.balance,
        "earnings": request.user.earnings,
        "followers": followers_count,
        "following": following_count,
        "is_member": request.user.is_member,
    })

# ==========================
# WITHDRAWAL
# ==========================

@login_required
def request_withdrawal(request):
    if request.method != "POST":
        return JsonResponse({
            "success": False,
            "message": "Invalid request method."
        }, status=405)

    user = request.user
    method = request.POST.get("method")
    amount = request.POST.get("amount")

    if not method or not amount:
        return JsonResponse({
            "success": False,
            "message": "Withdrawal method and amount are required."
        }, status=400)

    amount = Decimal(amount)

    if amount <= 0:
        return JsonResponse({
            "success": False,
            "message": "Invalid withdrawal amount."
        }, status=400)

    if user.balance < amount:
        return JsonResponse({
            "success": False,
            "message": "Insufficient balance."
        }, status=400)

    withdrawal = WithdrawalRequest.objects.create(
        user=user,
        amount=amount,
        method=method,
        account_name=request.POST.get("account_name"),
        bank_name=request.POST.get("bank_name"),
        sort_code=request.POST.get("sort_code"),
        account_number=request.POST.get("account_number"),
        paypal_email=request.POST.get("paypal_email"),
    )

    approve_url = request.build_absolute_uri(
        reverse("approve_withdrawal", args=[withdrawal.approval_token])
    )

    subject = "New SQUEEB Withdrawal Request"

    text_content = f"""
New Withdrawal Request

User: {user.username}
Email: {user.email}
Amount: £{amount}
Method: {method}

Approve after manual payment:
{approve_url}
"""

    html_content = f"""
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px;">
        <div style="max-width:620px;margin:auto;background:white;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);">

            <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:28px;">
                <h1 style="margin:0;font-size:24px;">SQUEEB Withdrawal Request</h1>
                <p style="margin:8px 0 0;">A user has requested a withdrawal.</p>
            </div>

            <div style="padding:28px;">
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">User</td>
                        <td style="padding:12px;">{user.username}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Email</td>
                        <td style="padding:12px;">{user.email}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Amount</td>
                        <td style="padding:12px;font-weight:bold;color:#2563eb;">£{amount}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Method</td>
                        <td style="padding:12px;">{method}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Account Name</td>
                        <td style="padding:12px;">{withdrawal.account_name or "-"}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Bank Name</td>
                        <td style="padding:12px;">{withdrawal.bank_name or "-"}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Sort Code</td>
                        <td style="padding:12px;">{withdrawal.sort_code or "-"}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">Account Number</td>
                        <td style="padding:12px;">{withdrawal.account_number or "-"}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">PayPal Email</td>
                        <td style="padding:12px;">{withdrawal.paypal_email or "-"}</td>
                    </tr>
                </table>

                <div style="margin-top:24px;text-align:center;">
                    <a href="{approve_url}"
                       style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:bold;">
                        Mark as Paid & Deduct Balance
                    </a>
                </div>

                <p style="margin-top:20px;color:#64748b;font-size:13px;">
                    Only click this after you have manually sent the payment.
                </p>
            </div>
        </div>
    </div>
    """

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.ADMIN_EMAIL],
    )

    email.attach_alternative(html_content, "text/html")
    email.send()

    return JsonResponse({
        "success": True,
        "message": "Withdrawal request submitted successfully."
    })



def approve_withdrawal(request, token):
    withdrawal = get_object_or_404(
        WithdrawalRequest,
        approval_token=token
    )

    if withdrawal.status == "paid":
        return HttpResponse("This withdrawal has already been marked as paid.")

    with transaction.atomic():
        user = withdrawal.user

        if user.balance < withdrawal.amount:
            return HttpResponse("User does not have enough balance.")

        user.balance -= withdrawal.amount
        user.save()

        withdrawal.status = "paid"
        withdrawal.paid_at = timezone.now()
        withdrawal.save()

    return HttpResponse("Withdrawal marked as paid and user balance deducted successfully.")


@login_required
def withdrawals(request):
    return render(request, "accounts/dashboard/withdrawals.html")




@login_required
def withdrawal_history_api(request):
    withdrawals = WithdrawalRequest.objects.filter(
        user=request.user
    ).order_by("-created_at")

    data = []

    pending_total = Decimal("0.00")
    paid_total = Decimal("0.00")
    rejected_count = 0

    for withdrawal in withdrawals:
        if withdrawal.status == "pending":
            pending_total += withdrawal.amount

        if withdrawal.status == "paid":
            paid_total += withdrawal.amount

        if withdrawal.status == "rejected":
            rejected_count += 1

        data.append({
            "id": withdrawal.id,
            "amount": str(withdrawal.amount),
            "method": withdrawal.method,
            "status": withdrawal.status,
            "created_at": withdrawal.created_at.strftime("%d %b %Y, %I:%M %p"),
            "paid_at": withdrawal.paid_at.strftime("%d %b %Y, %I:%M %p") if withdrawal.paid_at else "",
        })

    return JsonResponse({
        "withdrawals": data,
        "pending_total": str(pending_total),
        "paid_total": str(paid_total),
        "rejected_count": rejected_count,
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

    return render(request, "accounts/marketplace/sell.html")


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

@login_required
def my_task_submissions_api(request):
    submissions = TaskCompletion.objects.filter(
        user=request.user
    ).select_related("task").order_by("-completed_at")

    data = []

    for submission in submissions:
        data.append({
            "id": submission.id,
            "task_title": submission.task.title,
            "platform": submission.task.platforms,
            "reward": str(submission.reward_amount),
            "status": submission.status,
            "proof": submission.proof.url if submission.proof else "",
            "submitted_at": submission.completed_at.strftime("%d %b %Y, %I:%M %p"),
            "reviewed_at": submission.reviewed_at.strftime("%d %b %Y, %I:%M %p") if submission.reviewed_at else "",
        })

    return JsonResponse({"submissions": data})


@login_required
def my_tasks_api(request):
    tasks = Task.objects.filter(creator=request.user).order_by("-created_at")

    data = []

    for task in tasks:
        approved_count = TaskCompletion.objects.filter(
            task=task,
            status="approved"
        ).count()

        pending_count = TaskCompletion.objects.filter(
            task=task,
            status="pending"
        ).count()

        rejected_count = TaskCompletion.objects.filter(
            task=task,
            status="rejected"
        ).count()

        total_actions = task.available + approved_count + pending_count

        status = "completed" if task.available <= 0 else "active"

        data.append({
            "id": task.id,
            "title": task.title,
            "description": task.short_desc,
            "task_type": task.get_task_type_display(),
            "platform": task.platforms,
            "quantity": total_actions,
            "available": task.available,
            "pending": pending_count,
            "completed": approved_count,
            "rejected": rejected_count,
            "worker_reward": str(task.worker_reward),
            "total_cost": str(task.total_budget),
            "status": status,
        })

    return JsonResponse({
        "tasks": data,
        "total": tasks.count(),
        "active": tasks.filter(available__gt=0).count(),
        "completed": tasks.filter(available__lte=0).count(),
    })


@csrf_exempt
@login_required
def complete_task(request, task_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    if not request.user.is_member:
        return JsonResponse({"error": "Membership required."}, status=403)

    task = get_object_or_404(Task, id=task_id)

    if task.creator == request.user:
        return JsonResponse({"error": "You cannot complete your own task"}, status=400)

    if TaskCompletion.objects.filter(user=request.user, task=task).exists():
        return JsonResponse({"error": "You already submitted this task"}, status=400)

    if task.available <= 0:
        return JsonResponse({"error": "No slots remaining"}, status=400)

    proof = request.FILES.get("proof")

    if not proof:
        return JsonResponse({"error": "Screenshot proof is required."}, status=400)

    task.available -= 1
    task.save(update_fields=["available"])

    TaskCompletion.objects.create(
        user=request.user,
        task=task,
        proof=proof,
        reward_amount=task.worker_reward,
        status="pending"
    )

    return JsonResponse({
        "success": True,
        "message": "Task submitted for review. Your balance will update after approval.",
        "status": "pending"
    })


@csrf_exempt
@login_required
@transaction.atomic
def approve_task_completion(request, completion_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    completion = get_object_or_404(TaskCompletion, id=completion_id)

    if request.user != completion.task.creator and not request.user.is_staff:
        return JsonResponse({"error": "Not allowed"}, status=403)

    if completion.status == "approved":
        return JsonResponse({"error": "This task has already been approved"}, status=400)

    if completion.status == "rejected":
        return JsonResponse({"error": "Rejected task cannot be approved"}, status=400)

    reward = completion.reward_amount or completion.task.worker_reward

    completion.status = "approved"
    completion.reward_amount = reward
    completion.reviewed_at = timezone.now()
    completion.save(update_fields=["status", "reward_amount", "reviewed_at"])

    worker = completion.user
    worker.balance += reward
    worker.earnings += reward
    worker.tasks_completed += 1
    worker.save(update_fields=["balance", "earnings", "tasks_completed"])

    RecentActivity.objects.create(
        username=worker.username,
        platform=completion.task.platforms,
        message=f"@{worker.username} earned £{reward}",
        amount=reward
    )

    Notification.objects.create(
        user=worker,
        title="Task approved",
        message=f"Your proof for '{completion.task.title}' was approved. £{reward} has been added to your balance."
    )

    return JsonResponse({
        "success": True,
        "message": "Task approved and worker paid"
    })


@csrf_exempt
@login_required
def reject_task_completion(request, completion_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    completion = get_object_or_404(TaskCompletion, id=completion_id)

    if request.user != completion.task.creator and not request.user.is_staff:
        return JsonResponse({"error": "Not allowed"}, status=403)

    if completion.status == "approved":
        return JsonResponse({"error": "Approved task cannot be rejected"}, status=400)

    if completion.status == "rejected":
        return JsonResponse({"error": "This task has already been rejected"}, status=400)

    completion.status = "rejected"
    completion.reviewed_at = timezone.now()
    completion.save(update_fields=["status", "reviewed_at"])

    completion.task.available += 1
    completion.task.save(update_fields=["available"])

    Notification.objects.create(
        user=completion.user,
        title="Task rejected",
        message=f"Your proof for '{completion.task.title}' was rejected. Please make sure your screenshot clearly shows the completed task."
    )

    return JsonResponse({
        "success": True,
        "message": "Task rejected"
    })


@login_required
def task_submission_reviews(request, task_id):
    task = get_object_or_404(Task, id=task_id)

    if task.creator != request.user and not request.user.is_staff:
        return redirect("my_tasks")

    return render(request, "accounts/dashboard/task_submission_reviews.html", {
        "task": task
    })


@login_required
def task_submission_reviews_api(request, task_id):
    task = get_object_or_404(Task, id=task_id)

    if task.creator != request.user and not request.user.is_staff:
        return JsonResponse({"error": "Not allowed"}, status=403)

    submissions = TaskCompletion.objects.filter(
        task=task,
        status="pending"
    ).select_related("user", "task").order_by("-completed_at")

    data = []

    for submission in submissions:
        data.append({
            "id": submission.id,
            "worker": submission.user.username,
            "reward": str(submission.reward_amount),
            "proof": submission.proof.url if submission.proof else "",
            "submitted_at": submission.completed_at.strftime("%d %b %Y, %I:%M %p"),
        })

    return JsonResponse({
        "task": task.title,
        "submissions": data
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
    return render(request, "accounts/dashboard/more.html")

@login_required
def earnings(request):
    return render(request, "accounts/dashboard/earnings.html")