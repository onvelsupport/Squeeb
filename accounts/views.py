# ==========================================================
# STANDARD LIBRARY IMPORTS
# ==========================================================

import base64
import hashlib
import hmac
import json
import uuid
import urllib.error
import urllib.request
from decimal import Decimal
from functools import wraps
from django.db.models import Q


# ==========================================================
# THIRD-PARTY IMPORTS
# ==========================================================

import stripe


# ==========================================================
# DJANGO IMPORTS
# ==========================================================

from django.conf import settings
from django.contrib import messages
from .email_utils import send_account_email

from django.contrib.auth import (
    authenticate,
    get_user_model,
    login as django_login,
    logout,
    update_session_auth_hash,
)

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives, send_mail
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


# ==========================================================
# LOCAL MODEL IMPORTS
# ==========================================================

from .models import (
    AdminCampaign,
    CampaignSubmission,
    Follow,
    FundingPayment,
    Notification,
    Product,
    ProductImage,
    ProductMessage,
    RecentActivity,
    Referral,
    Task,
    TaskCompletion,
    WithdrawalRequest,
)


User = get_user_model()


# ==========================================================
# MARKETPLACE COUNTRY ACCESS
# ==========================================================

MARKETPLACE_ALLOWED_COUNTRIES = {
    "uk",
    "gb",
    "gbr",
    "united kingdom",
    "great britain",
    "england",
    "scotland",
    "wales",
    "northern ireland",
    #"nigeria",
}


def marketplace_country_allowed(country):
    country = (country or "").strip().lower()

    return country in MARKETPLACE_ALLOWED_COUNTRIES


def marketplace_access_required(view_func):
    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):

        if not marketplace_country_allowed(request.user.country):

            messages.error(
                request,
                "SQUEEB Marketplace is not currently available in your country."
            )

            return redirect("dashboard")

        return view_func(
            request,
            *args,
            **kwargs,
        )

    return wrapper


# ==========================================================
# CUSTOM SQUEEB ADMIN PROTECTION
# ==========================================================

def squeeb_admin_required(view_func):
    """
    Restricts access to authenticated staff users.

    Normal users and advertisers are redirected back to the
    standard SQUEEB dashboard.
    """

    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        if not request.user.is_staff:
            return redirect("dashboard")

        return view_func(request, *args, **kwargs)

    return wrapper


# ==========================================================
# SQUEEB ADMIN DASHBOARD
# ==========================================================

@squeeb_admin_required
def squeeb_admin_dashboard(request):
    """
    Displays summary information for the custom SQUEEB
    administration dashboard.
    """

    campaigns_count = AdminCampaign.objects.count()

    active_campaigns = AdminCampaign.objects.filter(
        status="active"
    ).count()

    pending_submissions = CampaignSubmission.objects.filter(
        status="pending"
    ).count()

    return render(
        request,
        "accounts/admin/admin_dashboard.html",
        {
            "campaigns_count": campaigns_count,
            "active_campaigns": active_campaigns,
            "pending_submissions": pending_submissions,
        },
    )


# ==========================================================
# ADMIN CAMPAIGN LIST
# ==========================================================

@squeeb_admin_required
def admin_campaigns(request):
    """
    Shows all campaigns created through the SQUEEB admin area.
    """

    campaigns = AdminCampaign.objects.select_related(
        "created_by"
    ).order_by("-created_at")

    return render(
        request,
        "accounts/admin/campaigns.html",
        {
            "campaigns": campaigns,
        },
    )


# ==========================================================
# ADMIN CAMPAIGN SUBMISSION LIST
# ==========================================================

@squeeb_admin_required
def admin_campaign_submissions(request):
    """
    Shows all campaign submissions in the custom SQUEEB admin.
    """

    status_filter = request.GET.get("status", "pending")

    submissions = CampaignSubmission.objects.select_related(
        "campaign",
        "user",
    ).order_by("-created_at")

    if status_filter in ["pending", "approved", "rejected"]:
        submissions = submissions.filter(status=status_filter)

    return render(
        request,
        "accounts/admin/campaign_submissions.html",
        {
            "submissions": submissions,
            "status_filter": status_filter,
        },
    )


# ==========================================================
# APPROVE CAMPAIGN SUBMISSION
# ==========================================================

@squeeb_admin_required
@require_POST
@transaction.atomic
def approve_campaign_submission(request, submission_id):
    """
    Approves a campaign submission and pays the user.

    The select_for_update calls help prevent the same
    submission being paid twice.
    """

    submission = get_object_or_404(
        CampaignSubmission.objects.select_for_update().select_related(
            "campaign",
            "user",
        ),
        id=submission_id,
    )

    if submission.status == "approved":
        messages.info(
            request,
            "This submission has already been approved.",
        )
        return redirect("admin_campaign_submissions")

    if submission.status == "rejected":
        messages.error(
            request,
            "A rejected submission cannot be approved.",
        )
        return redirect("admin_campaign_submissions")

    campaign = AdminCampaign.objects.select_for_update().get(
        id=submission.campaign_id
    )

    if campaign.participants >= campaign.max_participants:
        messages.error(
            request,
            "This campaign has already reached its participant limit.",
        )
        return redirect("admin_campaign_submissions")

    reward = campaign.reward
    user = submission.user

    submission.status = "approved"
    submission.reviewed_at = timezone.now()
    submission.rejection_reason = ""
    submission.save(
        update_fields=[
            "status",
            "reviewed_at",
            "rejection_reason",
        ]
    )

    campaign.participants += 1
    campaign.save(update_fields=["participants"])

    user.balance += reward
    user.earnings += reward
    user.tasks_completed += 1
    user.save(
        update_fields=[
            "balance",
            "earnings",
            "tasks_completed",
        ]
    )

    Notification.objects.create(
        user=user,
        title="Campaign approved",
        message=(
            f"Your submission for '{campaign.title}' was approved. "
            f"£{reward} has been added to your wallet."
        ),
    )

    send_account_email(
    user=user,
    subject="Your SQUEEB campaign reward has been credited",
    heading="Campaign reward added",
    message=(
        f"Your submission for '{campaign.title}' was approved "
        "and the reward has been added to your wallet."
    ),
    details=[
        {
            "label": "Reward",
            "value": f"£{reward}",
        },
        {
            "label": "New balance",
            "value": f"£{user.balance}",
        },
    ],
)

    RecentActivity.objects.create(
        username=user.username,
        platform=campaign.platform,
        message=(
            f"@{user.username} earned £{reward} "
            f"from a SQUEEB campaign"
        ),
        amount=reward,
    )

    messages.success(
        request,
        f"Submission approved and £{reward} paid to {user.username}.",
    )

    return redirect("admin_campaign_submissions")


# ==========================================================
# REJECT CAMPAIGN SUBMISSION
# ==========================================================

@squeeb_admin_required
@require_POST
def reject_campaign_submission(request, submission_id):
    """
    Rejects a pending campaign submission and saves the reason.
    """

    submission = get_object_or_404(
        CampaignSubmission,
        id=submission_id,
    )

    if submission.status == "approved":
        messages.error(
            request,
            "An approved submission cannot be rejected.",
        )
        return redirect("admin_campaign_submissions")

    if submission.status == "rejected":
        messages.info(
            request,
            "This submission has already been rejected.",
        )
        return redirect("admin_campaign_submissions")

    rejection_reason = request.POST.get(
        "rejection_reason",
        "",
    ).strip()

    if not rejection_reason:
        messages.error(
            request,
            "Enter a rejection reason.",
        )
        return redirect("admin_campaign_submissions")

    submission.status = "rejected"
    submission.reviewed_at = timezone.now()
    submission.rejection_reason = rejection_reason
    submission.save(
        update_fields=[
            "status",
            "reviewed_at",
            "rejection_reason",
        ]
    )

    Notification.objects.create(
        user=submission.user,
        title="Campaign rejected",
        message=(
            f"Your submission for '{submission.campaign.title}' "
            f"was rejected. Reason: {rejection_reason}"
        ),
    )

    messages.success(
        request,
        "Submission rejected.",
    )

    return redirect("admin_campaign_submissions")


# ==========================================================
# ADMIN CREATE CAMPAIGN PAGE
# ==========================================================

@squeeb_admin_required
def admin_create_campaign_page(request):
    """
    Displays the campaign creation form and creates a campaign
    when the form is submitted.
    """

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        description = request.POST.get("description", "").strip()
        reward = request.POST.get("reward", "").strip()
        platform = request.POST.get("platform", "").strip()
        max_participants = request.POST.get(
            "max_participants",
            "",
        ).strip()
        start_date = request.POST.get("start_date", "").strip()
        end_date = request.POST.get("end_date", "").strip()
        status = request.POST.get("status", "draft").strip()
        image = request.FILES.get("image")

        # Validate required fields.
        if not all([
            title,
            description,
            reward,
            platform,
            max_participants,
            start_date,
            end_date,
        ]):
            messages.error(
                request,
                "Please complete all required fields.",
            )

            return render(
                request,
                "accounts/admin/create_campaign.html",
            )

        try:
            reward = Decimal(reward)
            max_participants = int(max_participants)

        except (ValueError, TypeError):
            messages.error(
                request,
                "Enter a valid reward and participant limit.",
            )

            return render(
                request,
                "accounts/admin/create_campaign.html",
            )

        if reward <= Decimal("0.00"):
            messages.error(
                request,
                "Campaign reward must be greater than £0.",
            )

            return render(
                request,
                "accounts/admin/create_campaign.html",
            )

        if max_participants <= 0:
            messages.error(
                request,
                "Maximum participants must be at least 1.",
            )

            return render(
                request,
                "accounts/admin/create_campaign.html",
            )

        if end_date < start_date:
            messages.error(
                request,
                "The end date cannot be before the start date.",
            )

            return render(
                request,
                "accounts/admin/create_campaign.html",
            )

        AdminCampaign.objects.create(
            title=title,
            description=description,
            reward=reward,
            platform=platform,
            max_participants=max_participants,
            start_date=start_date,
            end_date=end_date,
            status=status,
            image=image,
            created_by=request.user,
        )

        messages.success(
            request,
            "Campaign created successfully.",
        )

        return redirect("admin_campaigns")

    return render(
        request,
        "accounts/admin/create_campaign.html",
    )


# ==========================================================
# ADMIN CREATE CAMPAIGN API
# ==========================================================

@squeeb_admin_required
@require_POST
def admin_create_campaign(request):
    """
    Creates a campaign through an AJAX or JavaScript request.

    This endpoint is protected by the custom SQUEEB admin
    permission check.
    """

    title = request.POST.get("title", "").strip()
    description = request.POST.get("description", "").strip()
    reward = request.POST.get("reward", "").strip()
    platform = request.POST.get("platform", "").strip()

    max_participants = request.POST.get(
        "max_participants",
        "",
    ).strip()

    start_date = request.POST.get("start_date", "").strip()
    end_date = request.POST.get("end_date", "").strip()
    status = request.POST.get("status", "draft").strip()
    image = request.FILES.get("image")

    if not all([
        title,
        description,
        reward,
        platform,
        max_participants,
        start_date,
        end_date,
    ]):
        return JsonResponse(
            {
                "error": "Please fill in all required fields.",
            },
            status=400,
        )

    try:
        reward = Decimal(reward)
        max_participants = int(max_participants)

    except (ValueError, TypeError):
        return JsonResponse(
            {
                "error": (
                    "Reward and maximum participants "
                    "must contain valid numbers."
                ),
            },
            status=400,
        )

    if reward <= Decimal("0.00"):
        return JsonResponse(
            {
                "error": "Campaign reward must be greater than £0.",
            },
            status=400,
        )

    if max_participants <= 0:
        return JsonResponse(
            {
                "error": "Maximum participants must be at least 1.",
            },
            status=400,
        )

    if end_date < start_date:
        return JsonResponse(
            {
                "error": (
                    "The campaign end date cannot be before "
                    "the start date."
                ),
            },
            status=400,
        )

    campaign = AdminCampaign.objects.create(
        title=title,
        description=description,
        reward=reward,
        platform=platform,
        max_participants=max_participants,
        start_date=start_date,
        end_date=end_date,
        status=status,
        image=image,
        created_by=request.user,
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Campaign created successfully.",
            "campaign_id": campaign.id,
        },
        status=201,
    )


# ==========================================================
# AVAILABLE TASKS AND ADMIN CAMPAIGNS API
# ==========================================================

# ==========================================================
# GET SINGLE ADMIN CAMPAIGN
# ==========================================================

@login_required
def get_campaign(request, campaign_id):
    """
    Returns the full details of one active SQUEEB campaign.
    """


    today = timezone.now().date()

    campaign = get_object_or_404(
        AdminCampaign,
        id=campaign_id,
        status="active",
        start_date__lte=today,
        end_date__gte=today,
    )

    if CampaignSubmission.objects.filter(
        campaign=campaign,
        user=request.user,
    ).exists():
        return JsonResponse(
            {
                "error": (
                    "You have already submitted this campaign."
                ),
            },
            status=400,
        )

    slots_remaining = max(
        0,
        campaign.max_participants - campaign.participants,
    )

    if slots_remaining <= 0:
        return JsonResponse(
            {
                "error": "This campaign is full.",
            },
            status=400,
        )

    return JsonResponse({
        "id": campaign.id,
        "title": campaign.title,
        "payout": str(campaign.reward),
        "available": slots_remaining,
        "platform": campaign.get_platform_display(),
        "task_type": "SQUEEB Campaign",
        "instructions": campaign.description,
        "link": "",
        "featured": True,
    })


# ==========================================================
# SUBMIT ADMIN CAMPAIGN PROOF
# ==========================================================

@csrf_exempt
@login_required
@transaction.atomic
def submit_campaign(request, campaign_id):
    """
    Allows a member to submit proof for a SQUEEB campaign.

    The submission remains pending until a SQUEEB admin approves
    or rejects it.
    """

    if request.method != "POST":
        return JsonResponse(
            {
                "error": "POST request required.",
            },
            status=405,
        )


    today = timezone.now().date()

    campaign = get_object_or_404(
        AdminCampaign.objects.select_for_update(),
        id=campaign_id,
        status="active",
        start_date__lte=today,
        end_date__gte=today,
    )

    if CampaignSubmission.objects.filter(
        campaign=campaign,
        user=request.user,
    ).exists():
        return JsonResponse(
            {
                "error": (
                    "You have already submitted this campaign."
                ),
            },
            status=400,
        )

    # Pending submissions reserve campaign spaces so the campaign
    # cannot receive more submissions than its participant limit.
    reserved_slots = CampaignSubmission.objects.filter(
        campaign=campaign,
        status__in=["pending", "approved"],
    ).count()

    if reserved_slots >= campaign.max_participants:
        return JsonResponse(
            {
                "error": "No campaign slots remaining.",
            },
            status=400,
        )

    video_link = request.POST.get(
        "video_link",
        "",
    ).strip()

    screenshot = request.FILES.get("proof")

    if not video_link:
        return JsonResponse(
            {
                "error": (
                    "Your published social media video link "
                    "is required."
                ),
            },
            status=400,
        )

    if not screenshot:
        return JsonResponse(
            {
                "error": "Screenshot proof is required.",
            },
            status=400,
        )

    submission = CampaignSubmission.objects.create(
        campaign=campaign,
        user=request.user,
        username=request.user.username,
        video_link=video_link,
        screenshot=screenshot,
        status="pending",
    )

    Notification.objects.create(
        user=request.user,
        title="Campaign submitted",
        message=(
            f"Your submission for '{campaign.title}' "
            "has been sent for review."
        ),
    )

    return JsonResponse(
        {
            "success": True,
            "submission_id": submission.id,
            "status": submission.status,
            "message": (
                "Campaign submitted for review. "
                "Your balance will be updated after approval."
            ),
        },
        status=201,
    )

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
def bank_details_api(request):
    user = request.user

    is_nigeria = _is_nigeria_country(
        user.country
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "success": True,
                "country": (
                    "Nigeria"
                    if is_nigeria
                    else user.country
                ),
                "is_nigeria": is_nigeria,
                "account_name": user.bank_account_name or "",
                "bank_name": user.bank_name or "",
                "bank_code": user.bank_code or "",
                "sort_code": user.sort_code or "",
                "account_number": user.account_number or "",
            }
        )

    if request.method != "POST":
        return JsonResponse(
            {
                "success": False,
                "error": "Method not allowed.",
            },
            status=405,
        )

    try:
        data = json.loads(
            request.body.decode("utf-8") or "{}"
        )
    except (
        json.JSONDecodeError,
        UnicodeDecodeError,
    ):
        return JsonResponse(
            {
                "success": False,
                "error": "Invalid request data.",
            },
            status=400,
        )

    account_name = str(
        data.get("account_name", "")
    ).strip()

    bank_name = str(
        data.get("bank_name", "")
    ).strip()

    bank_code = str(
        data.get("bank_code", "")
    ).strip()

    account_number = "".join(
        char
        for char in str(
            data.get("account_number", "")
        )
        if char.isdigit()
    )

    sort_code = "".join(
        char
        for char in str(
            data.get("sort_code", "")
        )
        if char.isdigit()
    )

    if not account_name:
        return JsonResponse(
            {
                "success": False,
                "error": "Account name is required.",
            },
            status=400,
        )

    if is_nigeria:
        if len(account_number) != 10:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "Enter a valid 10-digit "
                        "Nigerian account number."
                    ),
                },
                status=400,
            )

        if not bank_code:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Select your bank.",
                },
                status=400,
            )

        try:
            banks = _get_nigerian_banks()
        except RuntimeError as error:
            return JsonResponse(
                {
                    "success": False,
                    "error": str(error),
                },
                status=503,
            )

        selected_bank = next(
            (
                bank
                for bank in banks
                if str(bank["code"]) == bank_code
            ),
            None,
        )

        if not selected_bank:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "The selected bank is invalid. "
                        "Refresh the page and try again."
                    ),
                },
                status=400,
            )

        bank_name = selected_bank["name"]
        sort_code = ""

    else:
        if not bank_name:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Bank name is required.",
                },
                status=400,
            )

        if len(sort_code) != 6:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "Enter a valid 6-digit sort code."
                    ),
                },
                status=400,
            )

        if len(account_number) != 8:
            return JsonResponse(
                {
                    "success": False,
                    "error": (
                        "Enter a valid 8-digit UK account number."
                    ),
                },
                status=400,
            )

        bank_code = ""

    try:
        user.bank_account_name = account_name
        user.bank_name = bank_name
        user.bank_code = bank_code
        user.sort_code = sort_code
        user.account_number = account_number

        user.save(
            update_fields=[
                "bank_account_name",
                "bank_name",
                "bank_code",
                "sort_code",
                "account_number",
            ]
        )

    except Exception as error:
        print(
            "BANK DETAILS SAVE ERROR:",
            repr(error),
        )

        return JsonResponse(
            {
                "success": False,
                "error": "Could not save bank details.",
            },
            status=500,
        )

    try:
        Notification.objects.create(
            user=user,
            title="Bank Details Updated",
            message=(
                "Your payout bank details "
                "were updated successfully."
            ),
        )
    except Exception as error:
        print(
            "BANK DETAILS NOTIFICATION ERROR:",
            repr(error),
        )

    try:
        details = [
            {
                "label": "Account name",
                "value": account_name,
            },
            {
                "label": "Bank",
                "value": bank_name,
            },
            {
                "label": "Country",
                "value": (
                    "Nigeria"
                    if is_nigeria
                    else str(user.country).title()
                ),
            },
            {
                "label": "Account ending",
                "value": f"••••{account_number[-4:]}",
            },
        ]

        if not is_nigeria:
            details.append(
                {
                    "label": "Sort code",
                    "value": (
                        f"{sort_code[:2]}-"
                        f"{sort_code[2:4]}-"
                        f"{sort_code[4:6]}"
                    ),
                }
            )

        send_account_email(
            user=user,
            subject=(
                "Your SQUEEB bank details were updated"
            ),
            heading="Bank details updated",
            message=(
                "Your payout bank details "
                "were updated successfully."
            ),
            details=details,
        )

    except Exception as error:
        print(
            "BANK DETAILS EMAIL ERROR:",
            repr(error),
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Bank details saved successfully.",
            "country": (
                "Nigeria"
                if is_nigeria
                else user.country
            ),
            "is_nigeria": is_nigeria,
            "account_name": account_name,
            "bank_name": bank_name,
            "bank_code": bank_code,
            "sort_code": sort_code,
            "account_number": account_number,
        },
        status=200,
    )

@login_required
def my_tasks(request):
    return render(request, "accounts/dashboard/my_tasks.html")

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



@login_required
def global_search(request):
    q = request.GET.get("q", "").strip()

    # Do not hit three tables for one-character / empty searches.
    if len(q) < 2:
        return JsonResponse({"results": []})

    results = []

    users = User.objects.filter(
        username__icontains=q
    ).only("username")[:5]

    for user in users:
        results.append({
            "name": user.username,
            "type": "User",
            "url": f"/user/{user.username}/",
        })

    products = Product.objects.filter(
        title__icontains=q,
        is_sold=False,
    ).only("title")[:5]

    for product in products:
        results.append({
            "name": product.title,
            "type": "Product",
            "url": "/market/",
        })

    tasks = Task.objects.filter(
        title__icontains=q
    ).only("title")[:5]

    for task in tasks:
        results.append({
            "name": task.title,
            "type": "Task",
            "url": "/earnings/",
        })

    return JsonResponse({"results": results})

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

@marketplace_access_required
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


from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def forgot_password_api(request):
    if request.method != "POST":
        return redirect("forgot_password")

    email = request.POST.get(
        "email",
        "",
    ).strip().lower()

    if not email:
        return redirect("forgot_password")

    User = get_user_model()

    try:
        user = User.objects.get(
            email__iexact=email
        )
    except User.DoesNotExist:
        # Do not reveal whether an email exists.
        return redirect("password_reset_done")

    uid = urlsafe_base64_encode(
        force_bytes(user.pk)
    )

    token = default_token_generator.make_token(
        user
    )

    site_url = settings.SITE_URL.rstrip("/")

    reset_path = reverse(
        "password_reset_confirm",
        kwargs={
            "uidb64": uid,
            "token": token,
        },
    )

    reset_link = f"{site_url}{reset_path}"

    send_account_email(
        user=user,
        subject="Reset your SQUEEB password",
        heading="Password reset requested",
        message=(
            "We received a request to reset your SQUEEB password. "
            "Use the button below to create a new password."
        ),
        details=[
            {
                "label": "Account",
                "value": user.username,
            },
            {
                "label": "Request",
                "value": "Password reset",
            },
        ],
        action_url=reset_link,
        action_text="Reset Password",
    )

    return redirect("password_reset_done")


# ==========================
# AUTH HTML + PROTECTED PAGE
# ==========================
@login_required
def dashboard(request):
    """
    Render the dashboard with the important user data already present.

    This avoids waiting for /api/user-info/ before the dashboard looks
    complete. Notifications themselves are still lazy-loaded only when
    the user opens the notification panel.
    """
    followers_count = Follow.objects.filter(
        following=request.user
    ).count()

    following_count = Follow.objects.filter(
        follower=request.user
    ).count()

    notification_count = Notification.objects.filter(
        user=request.user,
        is_read=False,
    ).count()

    is_nigerian = _is_nigeria_country(request.user.country)

    context = {
        "notification_count": notification_count,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_nigerian": is_nigerian,
    }

    return render(
        request,
        "accounts/dashboard/dashboard.html",
        context,
    )

# ==========================
# AUTH APIs
# ==========================
@csrf_exempt
def signup(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST method required"}, status=400)

    data = json.loads(request.body.decode("utf-8"))

    username = data.get("username", "").strip().lower()
    email = data.get("email", "").strip().lower()
    country = data.get("country", "").strip()
    password = data.get("password")
    referral_code = (
        data.get("referral_code") or
        request.GET.get("ref") or
        ""
    ).strip().upper()

    from django.contrib.auth import get_user_model
    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already exists"}, status=400)

    if not country:
        return JsonResponse({"error": "Please select your country."}, status=400)

    referrer = None

    if referral_code:
        try:
            referrer = User.objects.get(referral_code=referral_code)
        except User.DoesNotExist:
            return JsonResponse({"error": "Invalid referral code"}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        country=country
    )

    if referrer and referrer != user:
        Referral.objects.get_or_create(
            referrer=referrer,
            referred_user=user,
            defaults={
                "code": referral_code
            }
        )

        referrer.referrals += 1
        referrer.save(update_fields=["referrals"])

        Notification.objects.create(
            user=referrer,
            title="New Referral",
            message=f"{user.username} joined SQUEEB using your referral link."
        )

        RecentActivity.objects.create(
            username=user.username,
            platform="referral",
            message=f"@{user.username} joined SQUEEB using a referral link",
            amount=0
        )

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

    username = data.get("username", "").strip().lower()
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
# REAL WALLET FUNDING
# ==========================

FLUTTERWAVE_API_BASE = "https://api.flutterwave.com/v3"


def _flutterwave_request(path, *, method="GET", payload=None):
    secret_key = getattr(settings, "FLUTTERWAVE_SECRET_KEY", "")

    if not secret_key:
        raise RuntimeError(
            "Flutterwave is not configured. "
            "Add FLUTTERWAVE_SECRET_KEY to your environment."
        )

    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        f"{FLUTTERWAVE_API_BASE}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SQUEEB/1.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            error_payload = json.loads(
                exc.read().decode("utf-8")
            )
            message = (
                error_payload.get("message")
                or "Flutterwave rejected the payment request."
            )
        except Exception:
            message = "Flutterwave rejected the payment request."

        raise RuntimeError(message) from exc
    except (
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
    ) as exc:
        raise RuntimeError(
            "The payment provider is temporarily unavailable."
        ) from exc


NIGERIAN_BANKS_CACHE_KEY = "squeeb_nigerian_banks"
NIGERIAN_BANKS_CACHE_SECONDS = 60 * 60 * 6


def _get_nigerian_banks(force_refresh=False):
    """
    Fetch Flutterwave's supported Nigerian banks and cache
    the public bank list for six hours.
    """

    if not force_refresh:
        cached = cache.get(
            NIGERIAN_BANKS_CACHE_KEY
        )

        if cached:
            return cached

    response = _flutterwave_request(
        "/banks/NG",
        method="GET",
    )

    if response.get("status") != "success":
        raise RuntimeError(
            response.get("message")
            or "Unable to load Nigerian banks."
        )

    banks = []

    for item in response.get("data") or []:
        name = str(
            item.get("name") or ""
        ).strip()

        code = str(
            item.get("code") or ""
        ).strip()

        if not name or not code:
            continue

        banks.append(
            {
                "name": name,
                "code": code,
            }
        )

    banks.sort(
        key=lambda bank:
        bank["name"].lower()
    )

    cache.set(
        NIGERIAN_BANKS_CACHE_KEY,
        banks,
        NIGERIAN_BANKS_CACHE_SECONDS,
    )

    return banks


@login_required
def nigerian_banks_api(request):
    if not _is_nigeria_country(
        request.user.country
    ):
        return JsonResponse(
            {
                "success": False,
                "message": (
                    "Nigerian banks are available "
                    "to Nigerian users only."
                ),
            },
            status=403,
        )

    try:
        banks = _get_nigerian_banks()

    except RuntimeError as error:
        return JsonResponse(
            {
                "success": False,
                "message": str(error),
            },
            status=503,
        )

    return JsonResponse(
        {
            "success": True,
            "banks": banks,
        }
    )


def _start_nigerian_funding(request, amount):
    """
    Nigerian users pay NGN through Flutterwave while the SQUEEB
    wallet is credited with the requested GBP amount after the
    transaction is independently verified.
    """
    rate = _get_gbp_ngn_rate()
    ngn_amount = (amount * rate).quantize(Decimal("0.01"))

    tx_ref = (
        f"SQB-NG-{request.user.id}-"
        f"{uuid.uuid4().hex[:16].upper()}"
    )

    payment = FundingPayment.objects.create(
        user=request.user,
        amount=amount,
        fee=Decimal("0.00"),
        total_charged=amount,
        method="nigeria",
        reference=tx_ref,
        provider="flutterwave",
        provider_reference=tx_ref,
        currency_paid="NGN",
        amount_paid=ngn_amount,
        exchange_rate=rate,
        status="pending",
    )

    site_url = getattr(
        settings,
        "SITE_URL",
        "https://squeeb.co.uk",
    ).rstrip("/")

    payload = {
        "tx_ref": tx_ref,
        "amount": str(ngn_amount),
        "currency": "NGN",
        "redirect_url": (
            f"{site_url}/dashboard/?funding=processing"
        ),
        "customer": {
            "email": request.user.email,
            "name": request.user.get_full_name()
            or request.user.username,
        },
        "customizations": {
            "title": "SQUEEB Wallet Funding",
            "description": (
                f"Add £{amount} to your SQUEEB wallet"
            ),
        },
        "meta": {
            "payment_id": payment.id,
            "wallet_amount_gbp": str(amount),
            "squeeb_user_id": request.user.id,
        },
    }

    response = _flutterwave_request(
        "/payments",
        method="POST",
        payload=payload,
    )

    checkout_url = (
        response.get("data", {}).get("link")
    )

    if response.get("status") != "success" or not checkout_url:
        payment.status = "failed"
        payment.save(update_fields=["status"])
        raise RuntimeError(
            response.get("message")
            or "Unable to create the Nigerian payment."
        )

    return payment, checkout_url


@csrf_exempt
@login_required
def create_funding_checkout(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "POST method required"},
            status=400,
        )

    try:
        data = json.loads(
            request.body.decode("utf-8") or "{}"
        )

        amount = Decimal(
            str(data.get("amount", "0"))
        ).quantize(Decimal("0.01"))

        method = data.get("method", "card")
        reference = data.get("reference", "")

    except Exception:
        return JsonResponse(
            {"error": "Invalid amount"},
            status=400,
        )

    if amount < Decimal("1.00"):
        return JsonResponse(
            {
                "error": (
                    "Minimum funding amount is £1.00"
                ),
            },
            status=400,
        )

    is_nigerian = _is_nigeria_country(
        request.user.country
    )

    # Nigeria must use the NGN / Flutterwave route.
    if is_nigerian:
        if method != "nigeria":
            return JsonResponse(
                {
                    "error": (
                        "Nigerian wallet funding must be "
                        "completed in Naira."
                    ),
                },
                status=400,
            )

        try:
            payment, checkout_url = _start_nigerian_funding(
                request,
                amount,
            )
        except RuntimeError as exc:
            return JsonResponse(
                {"error": str(exc)},
                status=503,
            )

        return JsonResponse(
            {
                "checkout_url": checkout_url,
                "provider": "flutterwave",
                "wallet_amount": str(payment.amount),
                "currency": payment.currency_paid,
                "amount_to_pay": str(payment.amount_paid),
                "exchange_rate": str(payment.exchange_rate),
            }
        )

    # Existing funding flow for users outside Nigeria.
    if method not in ["card", "bank"]:
        return JsonResponse(
            {"error": "Invalid funding method"},
            status=400,
        )

    if method == "card":
        fee = (
            amount * Decimal("0.02")
        ) + Decimal("0.25")

        fee = fee.quantize(Decimal("0.01"))
        total_charged = amount + fee

    else:
        fee = Decimal("0.00")
        total_charged = amount

    try:
        payment = FundingPayment.objects.create(
            user=request.user,
            amount=amount,
            fee=fee,
            total_charged=total_charged,
            method=method,
            reference=reference,
            provider=(
                "stripe"
                if method == "card"
                else "manual_bank"
            ),
            currency_paid="GBP",
            amount_paid=total_charged,
            status="pending",
        )

        if method == "bank":
            payment.status = "awaiting_verification"
            payment.save(update_fields=["status"])

            verify_url = request.build_absolute_uri(
                reverse(
                    "verify_bank_transfer",
                    args=[payment.id],
                )
            )

            subject = (
                "New Bank Transfer Awaiting Verification"
            )

            context = {
                "username": request.user.username,
                "email": request.user.email,
                "amount": payment.amount,
                "reference": payment.reference,
                "verify_url": verify_url,
            }

            html_message = render_to_string(
                "accounts/emails/"
                "bank_transfer_verification.html",
                context,
            )

            email = EmailMultiAlternatives(
                subject=subject,
                body=(
                    f"A new bank transfer from "
                    f"{request.user.username} "
                    "requires verification."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[settings.ADMIN_EMAIL],
            )

            email.attach_alternative(
                html_message,
                "text/html",
            )
            email.send()

            return JsonResponse(
                {
                    "message": (
                        "Transfer request sent. Your wallet "
                        "will be credited once payment is confirmed."
                    ),
                }
            )

        site_url = getattr(
            settings,
            "SITE_URL",
            "https://squeeb.co.uk",
        ).rstrip("/")

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            customer_email=request.user.email or None,
            line_items=[
                {
                    "price_data": {
                        "currency": "gbp",
                        "product_data": {
                            "name": "SQUEEB Wallet Funding",
                        },
                        "unit_amount": int(
                            total_charged * 100
                        ),
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "payment_id": str(payment.id),
                "user_id": str(request.user.id),
                "purpose": "wallet_funding",
                "wallet_amount": str(amount),
                "fee": str(fee),
                "total_charged": str(total_charged),
                "method": method,
            },
            success_url=(
                f"{site_url}/dashboard/?funding=success"
            ),
            cancel_url=(
                f"{site_url}/dashboard/?funding=cancelled"
            ),
        )

        payment.stripe_session_id = session.id
        payment.provider_reference = session.id
        payment.save(
            update_fields=[
                "stripe_session_id",
                "provider_reference",
            ]
        )

        return JsonResponse(
            {"checkout_url": session.url}
        )

    except Exception as exc:
        return JsonResponse(
            {"error": str(exc)},
            status=500,
        )


@login_required
def verify_bank_transfer(request, payment_id):
    if not request.user.is_staff:
        return JsonResponse({"error": "Not allowed"}, status=403)

    payment = get_object_or_404(FundingPayment, id=payment_id)

    if request.method == "POST":
        if payment.status == "paid":
            return JsonResponse({"error": "Payment already confirmed"}, status=400)

        user = payment.user
        user.balance += payment.amount
        user.save(update_fields=["balance"])

        payment.status = "paid"
        payment.paid_at = timezone.now()
        payment.save(update_fields=["status", "paid_at"])

        send_account_email(
    user=user,
    subject="Your SQUEEB wallet funding was confirmed",
    heading="Wallet credited",
    message=(
        "Your bank transfer has been verified and your "
        "SQUEEB wallet has been credited."
    ),
    details=[
        {
            "label": "Amount credited",
            "value": f"£{payment.amount}",
        },
        {
            "label": "New balance",
            "value": f"£{user.balance}",
        },
        {
            "label": "Reference",
            "value": payment.reference or "Not provided",
        },
    ],
)

        return JsonResponse({
            "message": f"Payment confirmed. £{payment.amount} credited to {user.username}."
        })

    return render(request, "accounts/dashboard/verify_bank_transfer.html", {
        "payment": payment
    })

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
        return JsonResponse(
            {
                "success": False,
                "message": "POST request required."
            },
            status=405,
        )

    try:
        data = json.loads(
            request.body.decode("utf-8") or "{}"
        )

        user = request.user

        # Save previous values for security notifications
        old_username = user.username
        old_email = user.email

        first_name = data.get(
            "first_name",
            ""
        ).strip()

        last_name = data.get(
            "last_name",
            ""
        ).strip()

        username = data.get(
            "username",
            ""
        ).strip().lower()

        email = data.get(
            "email",
            ""
        ).strip().lower()

        phone_number = data.get(
            "phone_number",
            ""
        ).strip()

        city = data.get(
            "city",
            ""
        ).strip()

        if not username:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Username is required."
                },
                status=400,
            )

        # Check username uniqueness
        if User.objects.filter(
            username=username
        ).exclude(
            id=user.id
        ).exists():

            return JsonResponse(
                {
                    "success": False,
                    "message": "Username already exists."
                },
                status=400,
            )

        # Check email uniqueness
        if (
            email and
            User.objects.filter(
                email=email
            ).exclude(
                id=user.id
            ).exists()
        ):
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        "Email address is already in use."
                    )
                },
                status=400,
            )

        user.first_name = first_name
        user.last_name = last_name
        user.username = username
        user.email = email

        if hasattr(user, "phone_number"):
            user.phone_number = phone_number

        if hasattr(user, "city"):
            user.city = city

        user.save()

        # --------------------------------------------------
        # SECURITY EMAIL
        # --------------------------------------------------

        changes = []

        if old_username != user.username:
            changes.append({
                "label": "Username",
                "value": f"{old_username} → {user.username}",
            })

        if old_email != user.email:
            changes.append({
                "label": "Email",
                "value": f"{old_email} → {user.email}",
            })

        if changes:

            Notification.objects.create(
                user=user,
                title="Account Updated",
                message=(
                    "Important account information was updated."
                ),
            )

            send_account_email(
                user=user,
                subject="Important changes to your SQUEEB account",
                heading="Account details updated",
                message=(
                    "Important information associated with your "
                    "SQUEEB account has recently changed."
                ),
                details=changes,
            )

        return JsonResponse(
            {
                "success": True,
                "message": "Profile updated successfully."
            }
        )

    except json.JSONDecodeError:
        return JsonResponse(
            {
                "success": False,
                "message": "Invalid JSON data."
            },
            status=400,
        )

    except Exception as e:
        print("EDIT PROFILE ERROR:", e)

        return JsonResponse(
            {
                "success": False,
                "message": str(e)
            },
            status=500,
        )
    



def influencer_terms(request):
    return render(request, "accounts/influencer_terms.html")


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



def _valid_flutterwave_signature(raw_body, signature):
    secret_hash = getattr(
        settings,
        "FLUTTERWAVE_SECRET_HASH",
        "",
    )

    if not secret_hash or not signature:
        return False

    expected = base64.b64encode(
        hmac.new(
            secret_hash.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")

    return hmac.compare_digest(
        expected,
        signature,
    )


def _verify_flutterwave_transaction(transaction_id):
    response = _flutterwave_request(
        f"/transactions/{transaction_id}/verify"
    )

    if response.get("status") != "success":
        raise RuntimeError(
            "Unable to verify the Flutterwave transaction."
        )

    return response.get("data") or {}


@csrf_exempt
@require_POST
def flutterwave_webhook(request):
    """
    Credit a Nigerian user's GBP wallet only after:
    1. webhook signature validation
    2. Flutterwave transaction verification
    3. amount/currency/reference comparison
    4. database row locking / idempotency
    """
    signature = request.headers.get(
        "flutterwave-signature"
    )

    if not _valid_flutterwave_signature(
        request.body,
        signature,
    ):
        return HttpResponse(status=401)

    try:
        payload = json.loads(
            request.body.decode("utf-8") or "{}"
        )
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    event_data = payload.get("data") or {}

    transaction_id = event_data.get("id")
    tx_ref = event_data.get("tx_ref")

    if not transaction_id or not tx_ref:
        return HttpResponse(status=200)

    try:
        verified = _verify_flutterwave_transaction(
            transaction_id
        )
    except RuntimeError:
        # Flutterwave can retry the webhook.
        return HttpResponse(status=503)

    try:
        with transaction.atomic():
            payment = (
                FundingPayment.objects
                .select_for_update()
                .select_related("user")
                .get(
                    provider="flutterwave",
                    provider_reference=tx_ref,
                )
            )

            if payment.status == "paid":
                return HttpResponse(status=200)

            verified_status = str(
                verified.get("status", "")
            ).lower()

            verified_currency = str(
                verified.get("currency", "")
            ).upper()

            verified_tx_ref = str(
                verified.get("tx_ref", "")
            )

            verified_amount = Decimal(
                str(verified.get("amount", "0"))
            )

            expected_amount = (
                payment.amount_paid
                or Decimal("0.00")
            )

            valid_payment = (
                verified_status == "successful"
                and verified_currency == "NGN"
                and verified_tx_ref
                == payment.provider_reference
                and verified_amount >= expected_amount
            )

            if not valid_payment:
                payment.status = "failed"
                payment.save(update_fields=["status"])
                return HttpResponse(status=200)

            user = User.objects.select_for_update().get(
                pk=payment.user_id
            )

            user.balance = (
                user.balance or Decimal("0.00")
            ) + payment.amount

            user.save(update_fields=["balance"])

            payment.status = "paid"
            payment.paid_at = timezone.now()
            payment.reference = str(
                verified.get("flw_ref")
                or payment.reference
                or ""
            )

            payment.save(
                update_fields=[
                    "status",
                    "paid_at",
                    "reference",
                ]
            )

            Notification.objects.create(
                user=user,
                title="Wallet funded",
                message=(
                    f"Your Nigerian payment was confirmed. "
                    f"£{payment.amount} has been added "
                    "to your SQUEEB wallet."
                ),
            )

            send_account_email(
                user=user,
                subject="Your SQUEEB wallet has been funded",
                heading="Wallet funding successful",
                message=(
                    "Your Naira payment was verified and "
                    "the funds have been added to your wallet."
                ),
                details=[
                    {
                        "label": "Amount credited",
                        "value": f"£{payment.amount}",
                    },
                    {
                        "label": "Naira paid",
                        "value": (
                            f"₦{payment.amount_paid:,.2f}"
                        ),
                    },
                    {
                        "label": "Exchange rate",
                        "value": (
                            f"£1 = "
                            f"₦{payment.exchange_rate:,.2f}"
                        ),
                    },
                    {
                        "label": "New balance",
                        "value": f"£{user.balance}",
                    },
                ],
            )

    except FundingPayment.DoesNotExist:
        return HttpResponse(status=200)

    return HttpResponse(status=200)


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

                    send_account_email(
    user=user,
    subject="Your SQUEEB wallet has been funded",
    heading="Wallet funding successful",
    message=(
        "Your card payment was successful and the funds "
        "have been added to your wallet."
    ),
    details=[
        {
            "label": "Amount credited",
            "value": f"£{payment.amount}",
        },
        {
            "label": "Funding fee",
            "value": f"£{payment.fee}",
        },
        {
            "label": "New balance",
            "value": f"£{user.balance}",
        },
    ],
)

        except FundingPayment.DoesNotExist:
            return HttpResponse(status=404)

    return HttpResponse(status=200)





# ==========================
# CART
# ==========================
@marketplace_access_required
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


@marketplace_access_required
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


@marketplace_access_required
def remove_from_cart(request, product_id):
    cart = request.session.get("cart", {})
    product_id = str(product_id)

    if product_id in cart:
        del cart[product_id]

    request.session["cart"] = cart
    request.session.modified = True

    return redirect("cart")


@marketplace_access_required
def edit_product(request, product_id):

    product = get_object_or_404(
        Product,
        id=product_id,
        seller=request.user,
    )

    if request.method == "POST":

        # ==========================================================
        # BASIC PRODUCT DETAILS
        # ==========================================================

        title = request.POST.get(
            "title",
            "",
        ).strip()

        price = request.POST.get(
            "price",
            "",
        ).strip()

        category = request.POST.get(
            "category",
            "",
        ).strip()

        description = request.POST.get(
            "description",
            "",
        ).strip()


        if not title:

            messages.error(
                request,
                "Product title is required.",
            )

            return redirect(
                "edit_product",
                product_id=product.id,
            )


        if not price:

            messages.error(
                request,
                "Product price is required.",
            )

            return redirect(
                "edit_product",
                product_id=product.id,
            )


        if not category:

            messages.error(
                request,
                "Product category is required.",
            )

            return redirect(
                "edit_product",
                product_id=product.id,
            )


        product.title = title
        product.price = price
        product.category = category
        product.description = description

        product.is_sold = (
            request.POST.get("is_sold") == "on"
        )

        product.save()


        # ==========================================================
        # REMOVE EXISTING PRODUCTIMAGE PHOTOS
        # ==========================================================

        raw_remove_ids = request.POST.get(
            "remove_image_ids",
            "",
        )

        remove_ids = []

        for value in raw_remove_ids.split(","):

            value = value.strip()

            if value.isdigit():
                remove_ids.append(
                    int(value)
                )


        if remove_ids:

            images_to_remove = product.images.filter(
                id__in=remove_ids
            )

            for product_image in images_to_remove:

                try:

                    if product_image.image:

                        product_image.image.delete(
                            save=False
                        )

                except Exception as error:

                    print(
                        "PRODUCT IMAGE FILE DELETE ERROR:",
                        repr(error),
                    )

                product_image.delete()


        # ==========================================================
        # REMOVE LEGACY MAIN PRODUCT IMAGE
        # ==========================================================

        remove_main_image = (
            request.POST.get("remove_main_image") == "1"
        )

        if remove_main_image and product.image:

            try:

                product.image.delete(
                    save=False
                )

            except Exception as error:

                print(
                    "MAIN PRODUCT IMAGE DELETE ERROR:",
                    repr(error),
                )

            product.image = ""

            product.save(
                update_fields=[
                    "image"
                ]
            )


        # ==========================================================
        # CROP / REPLACE EXISTING PRODUCTIMAGE PHOTOS
        # ==========================================================

        remaining_images = product.images.all()

        for product_image in remaining_images:

            field_name = (
                f"crop_existing_{product_image.id}"
            )

            replacement = request.FILES.get(
                field_name
            )

            if not replacement:
                continue


            old_image_name = (
                product_image.image.name
                if product_image.image
                else ""
            )

            old_storage = (
                product_image.image.storage
                if product_image.image
                else None
            )


            product_image.image = replacement

            product_image.save(
                update_fields=[
                    "image"
                ]
            )


            if (
                old_image_name
                and old_storage
                and old_image_name != product_image.image.name
            ):

                try:

                    old_storage.delete(
                        old_image_name
                    )

                except Exception as error:

                    print(
                        "OLD PRODUCT IMAGE DELETE ERROR:",
                        repr(error),
                    )


        # ==========================================================
        # CROP / REPLACE LEGACY MAIN IMAGE
        # ==========================================================

        cropped_main_image = request.FILES.get(
            "crop_main_image"
        )

        if cropped_main_image:

            old_main_name = (
                product.image.name
                if product.image
                else ""
            )

            old_main_storage = (
                product.image.storage
                if product.image
                else None
            )

            product.image = cropped_main_image

            product.save(
                update_fields=[
                    "image"
                ]
            )


            if (
                old_main_name
                and old_main_storage
                and old_main_name != product.image.name
            ):

                try:

                    old_main_storage.delete(
                        old_main_name
                    )

                except Exception as error:

                    print(
                        "OLD MAIN IMAGE DELETE ERROR:",
                        repr(error),
                    )


        # ==========================================================
        # ADD NEW PHOTOS
        # ==========================================================

        new_images = request.FILES.getlist(
            "images"
        )

        for image in new_images:

            ProductImage.objects.create(
                product=product,
                image=image,
            )


        messages.success(
            request,
            "Product updated successfully.",
        )

        return redirect(
            "product_detail",
            product_id=product.id,
        )


    return render(
        request,
        "accounts/marketplace/edit_product.html",
        {
            "product": product,
        },
    )


@marketplace_access_required
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

# ==========================================================
# MARKETPLACE MESSAGES
# ==========================================================

@marketplace_access_required
def messages_inbox(request):
    """
    Shows one conversation per product + user pair.

    The newest message becomes the inbox preview.
    """

    user = request.user

    all_messages = (
        ProductMessage.objects
        .filter(
            Q(sender=user) |
            Q(receiver=user)
        )
        .select_related(
            "product",
            "sender",
            "receiver",
        )
        .order_by("-created_at")
    )

    conversations = {}


    for message in all_messages:

        if message.sender_id == user.id:
            other_user = message.receiver
        else:
            other_user = message.sender


        key = (
            message.product_id,
            other_user.id,
        )


        if key not in conversations:

            conversations[key] = {
                "product": message.product,
                "other_user": other_user,
                "last_message": message,
                "unread_count": 0,
            }


        if (
            message.receiver_id == user.id
            and not message.is_read
        ):

            conversations[key]["unread_count"] += 1


    conversation_list = list(
        conversations.values()
    )


    total_unread = sum(
        conversation["unread_count"]
        for conversation in conversation_list
    )


    return render(
        request,
        "accounts/marketplace/messages.html",
        {
            "conversations": conversation_list,
            "total_unread": total_unread,
        },
    )


@marketplace_access_required
def messages_conversation(
    request,
    product_id,
    user_id,
):
    product = get_object_or_404(
        Product,
        id=product_id,
    )

    other_user = get_object_or_404(
        User,
        id=user_id,
    )


    # ==========================================================
    # SECURITY
    # ==========================================================

    if other_user.id == request.user.id:
        return redirect(
            "messages_inbox"
        )


    participant_ids = {
        request.user.id,
        other_user.id,
    }


    if product.seller_id not in participant_ids:
        return redirect(
            "messages_inbox"
        )


    # ==========================================================
    # SEND MESSAGE
    # ==========================================================

    if request.method == "POST":

        message_text = (
            request.POST
            .get(
                "message",
                "",
            )
            .strip()
        )


        is_ajax = (
            request.headers.get(
                "x-requested-with"
            )
            == "XMLHttpRequest"
        )


        if not message_text:

            if is_ajax:

                return JsonResponse(
                    {
                        "success": False,
                        "message": "Message cannot be empty.",
                    },
                    status=400,
                )


            return redirect(
                "messages_conversation",
                product_id=product.id,
                user_id=other_user.id,
            )


        if len(message_text) > 2000:

            if is_ajax:

                return JsonResponse(
                    {
                        "success": False,
                        "message": (
                            "Message must be 2000 characters or fewer."
                        ),
                    },
                    status=400,
                )


            return redirect(
                "messages_conversation",
                product_id=product.id,
                user_id=other_user.id,
            )


        new_message = ProductMessage.objects.create(
            product=product,
            sender=request.user,
            receiver=other_user,
            message=message_text,
        )


        # ======================================================
        # NOTIFICATION
        # ======================================================

        try:

            Notification.objects.create(
                user=other_user,
                title="New marketplace message",
                message=(
                    f"{request.user.username} sent you "
                    f"a message about {product.title}."
                ),
            )

        except Exception as error:

            # Messaging should still succeed even if
            # notification creation has a problem.

            print(
                "MESSAGE NOTIFICATION ERROR:",
                repr(error),
            )


        # ======================================================
        # AJAX RESPONSE
        # ======================================================

        if is_ajax:

            return JsonResponse(
                {
                    "success": True,
                    "message": {
                        "id": new_message.id,
                        "text": new_message.message,
                        "created_at": (
                            new_message.created_at.strftime(
                                "%d %b, %H:%M"
                            )
                        ),
                        "is_read": False,
                    },
                }
            )


        # ======================================================
        # NORMAL FORM FALLBACK
        # ======================================================

        return redirect(
            "messages_conversation",
            product_id=product.id,
            user_id=other_user.id,
        )


    # ==========================================================
    # MARK RECEIVED MESSAGES READ
    # ==========================================================

    ProductMessage.objects.filter(
        product=product,
        sender=other_user,
        receiver=request.user,
        is_read=False,
    ).update(
        is_read=True
    )


    # ==========================================================
    # LOAD CONVERSATION
    # ==========================================================

    conversation_messages = (
        ProductMessage.objects
        .filter(
            product=product,
        )
        .filter(
            Q(
                sender=request.user,
                receiver=other_user,
            )
            |
            Q(
                sender=other_user,
                receiver=request.user,
            )
        )
        .select_related(
            "sender",
            "receiver",
        )
        .order_by(
            "created_at"
        )
    )


    return render(
        request,
        "accounts/marketplace/messages_conversation.html",
        {
            "product": product,
            "other_user": other_user,
            "conversation_messages": conversation_messages,
        },
    )


@marketplace_access_required
def send_product_message(
    request,
    product_id,
):
    """
    Starts a conversation from the product-detail page.
    """

    product = get_object_or_404(
        Product,
        id=product_id,
    )


    if request.user == product.seller:

        return redirect(
            "product_detail",
            product_id=product.id,
        )


    if request.method == "POST":

        message_text = (
            request.POST
            .get(
                "message",
                "",
            )
            .strip()
        )


        if message_text:

            ProductMessage.objects.create(
                product=product,
                sender=request.user,
                receiver=product.seller,
                message=message_text,
            )


            Notification.objects.create(
                user=product.seller,
                title="New marketplace message",
                message=(
                    f"{request.user.username} sent you "
                    f"a message about {product.title}."
                ),
                link=reverse(
                    "messages_conversation",
                    args=[
                        product.id,
                        request.user.id,
                    ],
                ),
            )


            return redirect(
                "messages_conversation",
                product_id=product.id,
                user_id=product.seller.id,
            )


    return redirect(
        "product_detail",
        product_id=product.id,
    )


@marketplace_access_required
def seller_history(request):
    sold_products = Product.objects.filter(seller=request.user, is_sold=True).order_by("-id")

    return render(request, "accounts/marketplace/seller_history.html", {
        "products": sold_products
    })


@marketplace_access_required
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
from .models import Follow, TaskCompletion, Referral


@login_required
def user_info(request):
    followers_count = Follow.objects.filter(
        following=request.user
    ).count()

    following_count = Follow.objects.filter(
        follower=request.user
    ).count()

    approved_tasks_count = TaskCompletion.objects.filter(
        user=request.user,
        status="approved"
    ).count()

    referrals_count = Referral.objects.filter(
        referrer=request.user
    ).count()

    return JsonResponse({
        "username": request.user.username,
        "email": request.user.email,
        "country": request.user.country,
        "balance": str(request.user.balance),
        "earnings": str(request.user.earnings),

        "followers": followers_count,
        "following": following_count,

        "tasks_completed": approved_tasks_count,
        "referrals": referrals_count,

        "is_member": request.user.is_member,
        "first_withdrawal_completed": (
            request.user.first_withdrawal_completed
        ),
    })


# ==========================
# WITHDRAWAL
# ==========================

GBP_NGN_RATE_CACHE_KEY = "squeeb_gbp_ngn_rate"
GBP_NGN_RATE_CACHE_SECONDS = 60 * 60


def _withdrawal_fee_details(user, amount):
    """
    First successful withdrawal:
    - No membership required
    - 20% fee

    Future withdrawals:
    - Membership required
    - 10% fee
    """
    if not user.first_withdrawal_completed:
        fee_percentage = Decimal("20.00")
    else:
        fee_percentage = Decimal("10.00")

    fee_amount = (
        amount * fee_percentage / Decimal("100")
    ).quantize(Decimal("0.01"))

    net_amount = (
        amount - fee_amount
    ).quantize(Decimal("0.01"))

    return fee_percentage, fee_amount, net_amount


def _is_nigeria_country(country):
    value = (country or "").strip().lower()
    return value in {"ng", "nga", "nigeria"}


def _get_gbp_ngn_rate():
    """
    Fetch the GBP -> NGN reference rate server-side and cache it.

    ExchangeRate-API's open endpoint currently updates once per day.
    We cache for one hour to avoid unnecessary external requests.
    """
    cached_rate = cache.get(GBP_NGN_RATE_CACHE_KEY)

    if cached_rate:
        return Decimal(str(cached_rate))

    request = urllib.request.Request(
        "https://open.er-api.com/v6/latest/GBP",
        headers={
            "Accept": "application/json",
            "User-Agent": "SQUEEB/1.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        json.JSONDecodeError,
    ) as exc:
        raise RuntimeError(
            "The exchange-rate service is temporarily unavailable."
        ) from exc

    if payload.get("result") != "success":
        raise RuntimeError(
            "The exchange-rate service returned an invalid response."
        )

    ngn_rate = payload.get("rates", {}).get("NGN")

    if ngn_rate is None:
        raise RuntimeError(
            "The GBP to NGN exchange rate is temporarily unavailable."
        )

    rate = Decimal(str(ngn_rate)).quantize(Decimal("0.000001"))
    cache.set(
        GBP_NGN_RATE_CACHE_KEY,
        str(rate),
        GBP_NGN_RATE_CACHE_SECONDS,
    )
    return rate


@login_required
def gbp_ngn_exchange_rate(request):
    if not _is_nigeria_country(request.user.country):
        return JsonResponse(
            {
                "success": False,
                "bank_withdrawal_available": False,
                "message": (
                    "Bank withdrawals are temporarily unavailable "
                    "in your country."
                ),
            },
            status=403,
        )

    try:
        rate = _get_gbp_ngn_rate()
    except RuntimeError as exc:
        return JsonResponse(
            {
                "success": False,
                "message": str(exc),
            },
            status=503,
        )

    return JsonResponse(
        {
            "success": True,
            "base": "GBP",
            "currency": "NGN",
            "rate": str(rate),
            "bank_withdrawal_available": True,
        }
    )


@login_required
@require_POST
@transaction.atomic
def request_withdrawal(request):
    user = User.objects.select_for_update().get(
        pk=request.user.pk
    )

    if user.first_withdrawal_completed and not user.is_member:
        return JsonResponse(
            {
                "success": False,
                "membership_required": True,
                "message": (
                    "Your first withdrawal has been completed. "
                    "Activate SQUEEB Membership before requesting "
                    "another withdrawal."
                ),
            },
            status=403,
        )

    method = request.POST.get("method", "").strip()
    amount_raw = request.POST.get("amount", "").strip()

    if not method or not amount_raw:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    "Withdrawal method and amount are required."
                ),
            },
            status=400,
        )

    if method not in {"PayPal", "Bank"}:
        return JsonResponse(
            {
                "success": False,
                "message": "Invalid withdrawal method.",
            },
            status=400,
        )

    try:
        amount = Decimal(amount_raw).quantize(
            Decimal("0.01")
        )
    except Exception:
        return JsonResponse(
            {
                "success": False,
                "message": "Enter a valid withdrawal amount.",
            },
            status=400,
        )

    if method == "Bank":
        if not _is_nigeria_country(user.country):
            return JsonResponse(
            {
                "success": False,
                "message": (
                    "Bank withdrawals are currently available "
                    "to Nigerian users only."
                ),
            },
            status=403,
        )
        minimum_withdrawal = Decimal("5.00")
    else:
        minimum_withdrawal = Decimal("10.00")


    if amount < minimum_withdrawal:
        return JsonResponse(
        {
            "success": False,
            "message": (
                f"Minimum withdrawal amount is "
                f"£{minimum_withdrawal:.2f}."
            ),
        },
        status=400,
    )

    if user.balance < amount:
        return JsonResponse(
            {
                "success": False,
                "message": "Insufficient balance.",
            },
            status=400,
        )

    if WithdrawalRequest.objects.filter(
        user=user,
        status="pending",
    ).exists():
        return JsonResponse(
            {
                "success": False,
                "message": (
                    "You already have a pending withdrawal request. "
                    "Please wait for it to be processed."
                ),
            },
            status=400,
        )

    fee_percentage, fee_amount, net_amount = (
        _withdrawal_fee_details(
            user,
            amount,
        )
    )

    account_name = ""
    bank_name = ""
    bank_code = ""
    account_number = ""
    paypal_email = ""
    country = ""
    payout_currency = ""
    exchange_rate = None
    payout_amount = None

    if method == "Bank":
        if not _is_nigeria_country(user.country):
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        "Bank withdrawals are currently available "
                        "to Nigerian users only."
                    ),
                },
                status=403,
            )

        account_name = (
            user.bank_account_name or ""
        ).strip()

        bank_name = (
            user.bank_name or ""
        ).strip()

        bank_code = (
            user.bank_code or ""
        ).strip()

        account_number = (
            user.account_number or ""
        ).replace(" ", "").strip()

        if (
            not account_name
            or not bank_name
            or not bank_code
            or not account_number
        ):
            return JsonResponse(
                {
                    "success": False,
                    "bank_details_required": True,
                    "message": (
                        "Save your Nigerian bank details "
                        "before requesting a withdrawal."
                    ),
                },
                status=400,
            )

        if (
            not account_number.isdigit()
            or len(account_number) != 10
        ):
            return JsonResponse(
                {
                    "success": False,
                    "bank_details_required": True,
                    "message": (
                        "Your saved Nigerian account number "
                        "is invalid. Update your bank details."
                    ),
                },
                status=400,
            )

        try:
            supported_banks = _get_nigerian_banks()
        except RuntimeError as error:
            return JsonResponse(
                {
                    "success": False,
                    "message": str(error),
                },
                status=503,
            )

        bank_is_valid = any(
            str(bank["code"]) == bank_code
            for bank in supported_banks
        )

        if not bank_is_valid:
            return JsonResponse(
                {
                    "success": False,
                    "bank_details_required": True,
                    "message": (
                        "Your saved bank is no longer "
                        "available. Update your bank details."
                    ),
                },
                status=400,
            )

        try:
            exchange_rate = _get_gbp_ngn_rate()
        except RuntimeError as exc:
            return JsonResponse(
                {
                    "success": False,
                    "message": str(exc),
                },
                status=503,
            )

        payout_amount = (
            net_amount * exchange_rate
        ).quantize(Decimal("0.01"))

        country = "Nigeria"
        payout_currency = "NGN"

    else:
        paypal_email = request.POST.get(
            "paypal_email",
            "",
        ).strip()

        if not paypal_email or "@" not in paypal_email:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Enter a valid PayPal email address.",
                },
                status=400,
            )

    withdrawal = WithdrawalRequest.objects.create(
        user=user,
        amount=amount,
        fee_percentage=fee_percentage,
        fee_amount=fee_amount,
        net_amount=net_amount,
        method=method,
        country=country,
        account_name=account_name or None,
        bank_name=bank_name or None,
        bank_code=bank_code,
        account_number=account_number or None,
        paypal_email=paypal_email or None,
        payout_currency=payout_currency,
        exchange_rate=exchange_rate,
        payout_amount=payout_amount,
    )

    approve_url = request.build_absolute_uri(
        reverse(
            "approve_withdrawal",
            args=[withdrawal.approval_token],
        )
    )

    if method == "Bank":
        payout_summary = (
            f"₦{withdrawal.payout_amount:,.2f} "
            f"at £1 = ₦{withdrawal.exchange_rate:,.2f}"
        )
    else:
        payout_summary = f"£{net_amount}"

    subject = "New SQUEEB Withdrawal Request"

    text_content = f"""
New Withdrawal Request

User: {user.username}
Email: {user.email}
Requested amount: £{amount}
Fee: {fee_percentage}% (£{fee_amount})
Net after fee: £{net_amount}
Method: {method}
Payout: {payout_summary}
Bank: {withdrawal.bank_name or "-"}
Bank code: {withdrawal.bank_code or "-"}
Account name: {withdrawal.account_name or "-"}
Account number: {withdrawal.account_number or "-"}
PayPal: {withdrawal.paypal_email or "-"}

Approve after manual payment:
{approve_url}
"""

    bank_rows = ""

    if method == "Bank":
        bank_rows = f"""
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Country
            </td>
            <td style="padding:12px;">Nigeria</td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Bank
            </td>
            <td style="padding:12px;">{withdrawal.bank_name}</td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Bank Code
            </td>
            <td style="padding:12px;">{withdrawal.bank_code or "-"}</td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Account Name
            </td>
            <td style="padding:12px;">{withdrawal.account_name}</td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Account Number
            </td>
            <td style="padding:12px;">{withdrawal.account_number}</td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Exchange Rate
            </td>
            <td style="padding:12px;">
                £1 = ₦{withdrawal.exchange_rate:,.2f}
            </td>
        </tr>
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                Naira Payout
            </td>
            <td style="padding:12px;font-weight:bold;color:#15803d;">
                ₦{withdrawal.payout_amount:,.2f}
            </td>
        </tr>
        """
    else:
        bank_rows = f"""
        <tr>
            <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                PayPal Email
            </td>
            <td style="padding:12px;">
                {withdrawal.paypal_email}
            </td>
        </tr>
        """

    html_content = f"""
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px;">
        <div style="max-width:620px;margin:auto;background:white;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);">
            <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:28px;">
                <h1 style="margin:0;font-size:24px;">
                    SQUEEB Withdrawal Request
                </h1>
                <p style="margin:8px 0 0;">
                    A user has requested a withdrawal.
                </p>
            </div>

            <div style="padding:28px;">
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            User
                        </td>
                        <td style="padding:12px;">{user.username}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            Email
                        </td>
                        <td style="padding:12px;">{user.email}</td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            Requested
                        </td>
                        <td style="padding:12px;font-weight:bold;">
                            £{amount}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            Fee
                        </td>
                        <td style="padding:12px;">
                            {fee_percentage}% (£{fee_amount})
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            Net GBP
                        </td>
                        <td style="padding:12px;">
                            £{net_amount}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:12px;background:#f9fafb;font-weight:bold;">
                            Method
                        </td>
                        <td style="padding:12px;">{method}</td>
                    </tr>
                    {bank_rows}
                </table>

                <div style="margin-top:24px;text-align:center;">
                    <a
                        href="{approve_url}"
                        style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:bold;"
                    >
                        Mark as Paid & Deduct Balance
                    </a>
                </div>

                <p style="margin-top:20px;color:#64748b;font-size:13px;">
                    Make the payment manually first, then mark it as paid.
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
    email.attach_alternative(
        html_content,
        "text/html",
    )
    email.send()

    if method == "Bank":
        notification_message = (
            f"Your Nigerian bank withdrawal for £{amount} was submitted. "
            f"Estimated payout: ₦{payout_amount:,.2f}."
        )
        receive_value = f"₦{payout_amount:,.2f}"
    else:
        notification_message = (
            f"Your withdrawal request for £{amount} was submitted. "
            f"After the {fee_percentage}% fee, "
            f"you will receive £{net_amount}."
        )
        receive_value = f"£{net_amount}"

    Notification.objects.create(
        user=user,
        title="Withdrawal submitted",
        message=notification_message,
    )

    email_details = [
        {
            "label": "Requested amount",
            "value": f"£{amount}",
        },
        {
            "label": "Withdrawal fee",
            "value": (
                f"{fee_percentage}% "
                f"(£{fee_amount})"
            ),
        },
        {
            "label": "Amount to receive",
            "value": receive_value,
        },
        {
            "label": "Method",
            "value": method,
        },
        {
            "label": "Status",
            "value": "Pending",
        },
    ]

    if method == "Bank":
        email_details.insert(
            3,
            {
                "label": "Exchange rate",
                "value": f"£1 = ₦{exchange_rate:,.2f}",
            },
        )

    send_account_email(
        user=user,
        subject="Your SQUEEB withdrawal request was submitted",
        heading="Withdrawal request submitted",
        message=(
            "We received your withdrawal request. "
            "It is now pending review and payment."
        ),
        details=email_details,
    )

    return JsonResponse(
        {
            "success": True,
            "message": (
                "Withdrawal request submitted successfully."
            ),
            "amount": str(amount),
            "fee_percentage": str(fee_percentage),
            "fee_amount": str(fee_amount),
            "net_amount": str(net_amount),
            "exchange_rate": (
                str(exchange_rate)
                if exchange_rate is not None
                else None
            ),
            "payout_currency": payout_currency or "GBP",
            "payout_amount": (
                str(payout_amount)
                if payout_amount is not None
                else str(net_amount)
            ),
        }
    )


@transaction.atomic
def approve_withdrawal(request, token):
    withdrawal = get_object_or_404(
        WithdrawalRequest.objects
        .select_for_update()
        .select_related("user"),
        approval_token=token,
    )

    if withdrawal.status == "paid":
        return HttpResponse(
            "This withdrawal has already been marked as paid."
        )

    if withdrawal.status == "rejected":
        return HttpResponse(
            "A rejected withdrawal cannot be marked as paid."
        )

    user = User.objects.select_for_update().get(
        pk=withdrawal.user_id
    )

    if user.balance < withdrawal.amount:
        return HttpResponse(
            "User does not have enough balance."
        )

    user.balance -= withdrawal.amount

    if not user.first_withdrawal_completed:
        user.first_withdrawal_completed = True

    user.save(
        update_fields=[
            "balance",
            "first_withdrawal_completed",
        ]
    )

    withdrawal.status = "paid"
    withdrawal.paid_at = timezone.now()
    withdrawal.save(
        update_fields=[
            "status",
            "paid_at",
        ]
    )

    if (
        withdrawal.method == "Bank"
        and withdrawal.payout_currency == "NGN"
        and withdrawal.payout_amount is not None
    ):
        received_text = f"₦{withdrawal.payout_amount:,.2f}"
    else:
        received_text = f"£{withdrawal.net_amount}"

    Notification.objects.create(
        user=user,
        title="Withdrawal paid",
        message=(
            "Your withdrawal has been paid. "
            f"You received {received_text} after fees."
        ),
    )

    send_account_email(
        user=user,
        subject="Your SQUEEB withdrawal has been paid",
        heading="Withdrawal paid",
        message=(
            "Your withdrawal has been processed successfully."
        ),
        details=[
            {
                "label": "Requested amount",
                "value": f"£{withdrawal.amount}",
            },
            {
                "label": "Withdrawal fee",
                "value": (
                    f"{withdrawal.fee_percentage}% "
                    f"(£{withdrawal.fee_amount})"
                ),
            },
            {
                "label": "Amount received",
                "value": received_text,
            },
            {
                "label": "Method",
                "value": withdrawal.method,
            },
            {
                "label": "Status",
                "value": "Paid",
            },
        ],
    )

    return HttpResponse(
        "Withdrawal marked as paid and user balance "
        "deducted successfully."
    )


@login_required
def withdrawals(request):
    return render(
        request,
        "accounts/dashboard/withdrawals.html",
        {
            "first_withdrawal_completed": (
                request.user.first_withdrawal_completed
            ),
            "membership_required": (
                request.user.first_withdrawal_completed
                and not request.user.is_member
            ),
            "fee_percentage": (
                Decimal("10.00")
                if request.user.first_withdrawal_completed
                else Decimal("20.00")
            ),
        },
    )


@squeeb_admin_required
@require_POST
@transaction.atomic
def reject_withdrawal(request, withdrawal_id):
    withdrawal = get_object_or_404(
        WithdrawalRequest.objects.select_for_update().select_related(
            "user"
        ),
        id=withdrawal_id,
    )

    if withdrawal.status == "paid":
        return JsonResponse(
            {
                "error": "A paid withdrawal cannot be rejected.",
            },
            status=400,
        )

    if withdrawal.status == "rejected":
        return JsonResponse(
            {
                "error": "This withdrawal has already been rejected.",
            },
            status=400,
        )

    reason = request.POST.get(
        "reason",
        "The withdrawal could not be processed.",
    ).strip()

    withdrawal.status = "rejected"
    withdrawal.save(update_fields=["status"])

    Notification.objects.create(
        user=withdrawal.user,
        title="Withdrawal rejected",
        message=(
            f"Your withdrawal request for £{withdrawal.amount} "
            f"was rejected. Reason: {reason}"
        ),
    )

    send_account_email(
        user=withdrawal.user,
        subject="Your SQUEEB withdrawal was rejected",
        heading="Withdrawal rejected",
        message=(
            "Unfortunately, we could not process your withdrawal request."
        ),
        details=[
            {
                "label": "Requested amount",
                "value": f"£{withdrawal.amount}",
            },
            {
                "label": "Method",
                "value": withdrawal.method,
            },
            {
                "label": "Reason",
                "value": reason,
            },
            {
                "label": "Status",
                "value": "Rejected",
            },
        ],
    )

    return JsonResponse({
        "success": True,
        "message": "Withdrawal rejected.",
    })


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
        elif withdrawal.status == "paid":
            paid_total += withdrawal.net_amount
        elif withdrawal.status == "rejected":
            rejected_count += 1

        data.append(
            {
                "id": withdrawal.id,
                "amount": str(withdrawal.amount),
                "fee_percentage": str(withdrawal.fee_percentage),
                "fee_amount": str(withdrawal.fee_amount),
                "net_amount": str(withdrawal.net_amount),
                "method": withdrawal.method,
                "status": withdrawal.status,
                "country": withdrawal.country,
                "payout_currency": withdrawal.payout_currency,
                "exchange_rate": (
                    str(withdrawal.exchange_rate)
                    if withdrawal.exchange_rate is not None
                    else None
                ),
                "payout_amount": (
                    str(withdrawal.payout_amount)
                    if withdrawal.payout_amount is not None
                    else None
                ),
                "created_at": withdrawal.created_at.strftime(
                    "%d %b %Y, %I:%M %p"
                ),
                "paid_at": (
                    withdrawal.paid_at.strftime("%d %b %Y, %I:%M %p")
                    if withdrawal.paid_at
                    else ""
                ),
            }
        )

    return JsonResponse(
        {
            "withdrawals": data,
            "pending_total": str(pending_total),
            "paid_total": str(paid_total),
            "rejected_count": rejected_count,
            "membership_required": (
                request.user.first_withdrawal_completed
                and not request.user.is_member
            ),
            "is_member": request.user.is_member,
            "country": request.user.country,
            "nigeria_bank_available": _is_nigeria_country(
                request.user.country
            ),
        }
    )

# ==========================
# SELL PRODUCT
# ==========================
@csrf_exempt
@marketplace_access_required
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
@marketplace_access_required
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

    today = timezone.now().date()

    campaigns = AdminCampaign.objects.filter(
        status="active",
        start_date__lte=today,
        end_date__gte=today,
    ).exclude(
        submissions__user=request.user
    )

    campaign_data = []

    for campaign in campaigns:
        campaign_data.append({
            "id": campaign.id,
            "title": campaign.title,
            "payout": str(campaign.reward),
            "available": campaign.slots_remaining,
            "icon": campaign.image.url if campaign.image else "",
            "instructions": campaign.description,
            "short_desc": campaign.description,
            "platforms": campaign.platform,
            "task_type": "campaign",
            "featured": True,
        })

    tasks = Task.objects.filter(available__gt=0)
    tasks = tasks.exclude(creator=request.user)

    completed_task_ids = TaskCompletion.objects.filter(
        user=request.user
    ).values_list("task_id", flat=True)

    tasks = tasks.exclude(id__in=completed_task_ids)

    task_data = []

    for task in tasks:
        task_data.append({
            "id": task.id,
            "title": task.title,
            "payout": str(task.worker_reward),
            "available": task.available,
            "icon": task.icon,
            "instructions": task.instructions,
            "short_desc": task.short_desc,
            "platforms": task.platforms,
            "task_type": task.task_type,
            "featured": False,
        })

    return JsonResponse({
        "tasks": campaign_data + task_data
    })

@login_required
def get_single_task(request, task_id):

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
        "repost": {"cost": Decimal("0.10"), "reward": Decimal("0.07")},

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
    """
    Returns both normal task submissions and SQUEEB campaign
    submissions in one combined list.
    """

    combined_submissions = []

    # ======================================================
    # NORMAL TASK SUBMISSIONS
    # ======================================================

    task_submissions = TaskCompletion.objects.filter(
        user=request.user
    ).select_related("task").order_by("-completed_at")

    for submission in task_submissions:
        combined_submissions.append({
            "id": submission.id,
            "submission_type": "task",
            "task_title": submission.task.title,
            "platform": submission.task.platforms,
            "reward": str(submission.reward_amount),
            "status": submission.status,
            "proof": submission.proof.url if submission.proof else "",
            "video_link": "",
            "rejection_reason": "",
            "submitted_at": submission.completed_at.strftime(
                "%d %b %Y, %I:%M %p"
            ),
            "reviewed_at": (
                submission.reviewed_at.strftime("%d %b %Y, %I:%M %p")
                if submission.reviewed_at
                else ""
            ),
            "sort_date": submission.completed_at.timestamp(),
        })

    # ======================================================
    # SQUEEB CAMPAIGN SUBMISSIONS
    # ======================================================

    campaign_submissions = CampaignSubmission.objects.filter(
        user=request.user
    ).select_related("campaign").order_by("-created_at")

    for submission in campaign_submissions:
        combined_submissions.append({
            "id": submission.id,
            "submission_type": "campaign",
            "task_title": submission.campaign.title,
            "platform": submission.campaign.get_platform_display(),
            "reward": str(submission.campaign.reward),
            "status": submission.status,
            "proof": (
                submission.screenshot.url
                if submission.screenshot
                else ""
            ),
            "video_link": submission.video_link,
            "rejection_reason": submission.rejection_reason or "",
            "submitted_at": submission.created_at.strftime(
                "%d %b %Y, %I:%M %p"
            ),
            "reviewed_at": (
                submission.reviewed_at.strftime("%d %b %Y, %I:%M %p")
                if submission.reviewed_at
                else ""
            ),
            "sort_date": submission.created_at.timestamp(),
        })

    # Show newest submissions first.
    combined_submissions.sort(
        key=lambda item: item["sort_date"],
        reverse=True,
    )

    # Remove internal sorting value before returning JSON.
    for submission in combined_submissions:
        submission.pop("sort_date", None)

    return JsonResponse({
        "submissions": combined_submissions,
    })


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
        return JsonResponse(
            {"error": "POST required"},
            status=400
        )

    task = get_object_or_404(
        Task,
        id=task_id
    )

    if task.creator == request.user:
        return JsonResponse(
            {
                "error":
                "You cannot complete your own task"
            },
            status=400
        )

    if TaskCompletion.objects.filter(
        user=request.user,
        task=task
    ).exists():
        return JsonResponse(
            {
                "error":
                "You already submitted this task"
            },
            status=400
        )

    if task.available <= 0:
        return JsonResponse(
            {"error": "No slots remaining"},
            status=400
        )

    proof = request.FILES.get("proof")

    if not proof:
        return JsonResponse(
            {
                "error":
                "Screenshot proof is required."
            },
            status=400
        )

    # ==========================================================
    # SAVE SUBMISSION
    # This is your original working logic.
    # ==========================================================

    try:
        task.available -= 1

        task.save(
            update_fields=["available"]
        )

        completion = TaskCompletion.objects.create(
            user=request.user,
            task=task,
            proof=proof,
            reward_amount=task.worker_reward,
            status="pending"
        )

    except Exception as error:
        print(
            "TASK SUBMISSION SAVE ERROR:",
            repr(error)
        )

        return JsonResponse(
            {
                "error":
                "Unable to save your proof submission."
            },
            status=500
        )

    task_owner = task.creator


    # ==========================================================
    # IN-APP NOTIFICATION
    # Failure will NOT affect submission.
    # ==========================================================

    try:
        Notification.objects.create(
            user=task_owner,
            title="New task submission",
            message=(
                f"@{request.user.username} "
                f"submitted proof for "
                f"'{task.title}'."
            )
        )

    except Exception as error:
        print(
            "TASK OWNER NOTIFICATION ERROR:",
            repr(error)
        )


    # ==========================================================
    # EMAIL TASK OWNER
    # Failure will NOT affect submission.
    # ==========================================================

    if task_owner.email:

        try:
            site_url = getattr(
                settings,
                "SITE_URL",
                "https://squeeb.co.uk"
            ).rstrip("/")

            review_url = (
                f"{site_url}/my-tasks/"
                f"{task.id}/reviews/"
            )

            send_account_email(
                user=task_owner,

                subject=(
                    "New engagement on your "
                    f"SQUEEB task: {task.title}"
                ),

                heading=(
                    "Your task received "
                    "a new submission"
                ),

                message=(
                    f"@{request.user.username} "
                    "completed your task and "
                    "submitted proof for review."
                ),

                details=[
                    {
                        "label": "Task",
                        "value": task.title
                    },
                    {
                        "label": "Submitted by",
                        "value":
                            f"@{request.user.username}"
                    },
                    {
                        "label": "Reward",
                        "value":
                            f"£{task.worker_reward}"
                    },
                    {
                        "label": "Status",
                        "value": "Pending review"
                    },
                    {
                        "label": "Remaining slots",
                        "value":
                            str(task.available)
                    }
                ],

                action_url=review_url,
                action_text="Review Submission"
            )

        except Exception as error:
            print(
                "TASK OWNER EMAIL ERROR:",
                repr(error)
            )


    return JsonResponse(
        {
            "success": True,

            "completion_id":
                completion.id,

            "message": (
                "Task submitted for review. "
                "Your balance will update "
                "after approval."
            ),

            "status": "pending"
        },
        status=201
    )


@login_required
def update_password_page(request):
    return render(
        request,
        "accounts/update_password.html"
    )

@login_required
@require_POST
def update_password_api(request):
    try:
        data = json.loads(
            request.body.decode("utf-8")
        )

    except (
        json.JSONDecodeError,
        UnicodeDecodeError
    ):
        return JsonResponse(
            {
                "error": "Invalid request."
            },
            status=400
        )


    current_password = str(
        data.get("current_password", "")
    ).strip()

    new_password = str(
        data.get("new_password", "")
    )

    confirm_password = str(
        data.get("confirm_password", "")
    )


    # -----------------------------------------
    # REQUIRED FIELDS
    # -----------------------------------------

    if not current_password:
        return JsonResponse(
            {
                "error":
                "Please enter your current password."
            },
            status=400
        )

    if not new_password:
        return JsonResponse(
            {
                "error":
                "Please enter a new password."
            },
            status=400
        )

    if not confirm_password:
        return JsonResponse(
            {
                "error":
                "Please confirm your new password."
            },
            status=400
        )


    # -----------------------------------------
    # VERIFY CURRENT PASSWORD
    # -----------------------------------------

    if not request.user.check_password(
        current_password
    ):
        return JsonResponse(
            {
                "error":
                "Your current password is incorrect."
            },
            status=400
        )


    # -----------------------------------------
    # CONFIRM PASSWORD MATCH
    # -----------------------------------------

    if new_password != confirm_password:
        return JsonResponse(
            {
                "error":
                "Your new passwords do not match."
            },
            status=400
        )


    # -----------------------------------------
    # NEW PASSWORD MUST BE DIFFERENT
    # -----------------------------------------

    if request.user.check_password(
        new_password
    ):
        return JsonResponse(
            {
                "error":
                "Your new password must be different "
                "from your current password."
            },
            status=400
        )


    # -----------------------------------------
    # PASSWORD RULES
    # -----------------------------------------

    if len(new_password) < 8:
        return JsonResponse(
            {
                "error":
                "Password must contain at least 8 characters."
            },
            status=400
        )

    if not any(
        char.isupper()
        for char in new_password
    ):
        return JsonResponse(
            {
                "error":
                "Password must contain at least one uppercase letter."
            },
            status=400
        )

    if not any(
        char.islower()
        for char in new_password
    ):
        return JsonResponse(
            {
                "error":
                "Password must contain at least one lowercase letter."
            },
            status=400
        )

    if not any(
        char.isdigit()
        for char in new_password
    ):
        return JsonResponse(
            {
                "error":
                "Password must contain at least one number."
            },
            status=400
        )


    # -----------------------------------------
    # DJANGO PASSWORD VALIDATION
    # -----------------------------------------

    try:
        validate_password(
            new_password,
            user=request.user
        )

    except ValidationError as error:
        return JsonResponse(
            {
                "error":
                " ".join(
                    error.messages
                )
            },
            status=400
        )


    # -----------------------------------------
    # CHANGE PASSWORD
    # -----------------------------------------

    try:
        request.user.set_password(
            new_password
        )

        request.user.save()

        # Keep the current session active
        update_session_auth_hash(
            request,
            request.user
        )

    except Exception as error:
        print(
            "UPDATE PASSWORD ERROR:",
            repr(error)
        )

        return JsonResponse(
            {
                "error":
                "Could not update your password. "
                "Please try again."
            },
            status=500
        )


    # -----------------------------------------
    # IN-APP SECURITY NOTIFICATION
    # -----------------------------------------

    try:
        Notification.objects.create(
            user=request.user,
            title="Password Changed",
            message=(
                "Your SQUEEB account password "
                "was updated successfully."
            ),
        )

    except Exception as error:
        print(
            "PASSWORD NOTIFICATION ERROR:",
            repr(error)
        )


    # -----------------------------------------
    # SECURITY EMAIL
    # -----------------------------------------

    try:
        send_account_email(
            user=request.user,
            subject="Your SQUEEB password was changed",
            heading="Password updated",
            message=(
                "The password for your SQUEEB account "
                "was changed successfully."
            ),
            details=[
                {
                    "label": "Account",
                    "value": request.user.username,
                },
                {
                    "label": "Security action",
                    "value": "Password changed",
                },
                {
                    "label": "Date",
                    "value": timezone.localtime(
                        timezone.now()
                    ).strftime(
                        "%d %b %Y, %I:%M %p"
                    ),
                },
            ],
        )

    except Exception as error:
        print(
            "PASSWORD CHANGE EMAIL ERROR:",
            repr(error)
        )


    # -----------------------------------------
    # SUCCESS RESPONSE
    # -----------------------------------------

    return JsonResponse(
        {
            "success": True,
            "message":
                "Your password has been updated successfully."
        },
        status=200
    )

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

    send_account_email(
    user=worker,
    subject="Your SQUEEB wallet has been credited",
    heading="Task reward added",
    message=(
        f"Your proof for '{completion.task.title}' was approved "
        "and your reward has been added to your wallet."
    ),
    details=[
        {
            "label": "Reward",
            "value": f"£{reward}",
        },
        {
            "label": "New balance",
            "value": f"£{worker.balance}",
        },
        {
            "label": "Status",
            "value": "Approved",
        },
    ],
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
@require_POST
@transaction.atomic
def pay_membership(request):
    user = User.objects.select_for_update().get(
    pk=request.user.pk
    )

    user_country = (user.country or "").strip().lower()

    is_nigerian = user_country in {
    "nigeria",
    "ng",
    "nga",
    }

# Nigeria membership = £5
# Other countries = £10
    membership_fee = (
        Decimal("5.00")
        if is_nigerian
        else Decimal("10.00")
    )

    if user.is_member:
        return JsonResponse(
            {
                "success": False,
                "error": "Already a member.",
            },
            status=400,
        )

    if user.balance < membership_fee:
        return JsonResponse(
        {
            "success": False,
            "error": (
                f"Insufficient balance. You need "
                f"£{membership_fee:.2f} to activate membership."
            ),
        },
        status=400,
    )

    # ----------------------------------------------------------
    # REFERRAL REWARD
    # Nigeria: £5 total shared equally
    # Referrer: £2.50
    # Referred user: £2.50
    #
    # Other countries keep the existing £5 each.
    # ----------------------------------------------------------

    user_country = (user.country or "").strip().lower()

    is_nigerian = user_country in {
        "nigeria",
        "ng",
        "nga",
    }

    if is_nigerian:
        referrer_reward = Decimal("2.50")
        referee_reward = Decimal("2.50")
    else:
        referrer_reward = Decimal("5.00")
        referee_reward = Decimal("5.00")

    # Deduct the membership fee and activate membership.
    user.balance -= membership_fee
    user.is_member = True

    user.save(
        update_fields=[
            "balance",
            "is_member",
        ]
    )

    referral = (
        Referral.objects
        .select_for_update()
        .select_related("referrer")
        .filter(
            referred_user=user,
            rewarded=False,
        )
        .first()
    )

    referral_reward_paid = False
    referee_reward_paid = Decimal("0.00")
    referrer = None

    if referral:
        referrer = User.objects.select_for_update().get(
            pk=referral.referrer_id
        )

        # ------------------------------------------------------
        # PAY REFERRER
        # ------------------------------------------------------

        referrer.balance += referrer_reward
        referrer.earnings += referrer_reward

        referrer.save(
            update_fields=[
                "balance",
                "earnings",
            ]
        )

        # ------------------------------------------------------
        # PAY REFERRED USER
        # ------------------------------------------------------

        user.balance += referee_reward
        user.earnings += referee_reward

        user.save(
            update_fields=[
                "balance",
                "earnings",
            ]
        )

        # `reward` represents the reward earned by the referrer.
        referral.reward = referrer_reward
        referral.rewarded = True

        referral.save(
            update_fields=[
                "reward",
                "rewarded",
            ]
        )

        referral_reward_paid = True
        referee_reward_paid = referee_reward

        # ------------------------------------------------------
        # RECENT ACTIVITY
        # ------------------------------------------------------

        RecentActivity.objects.create(
            username=referrer.username,
            platform="referral",
            message=(
                f"@{referrer.username} earned "
                f"£{referrer_reward} from a referral"
            ),
            amount=referrer_reward,
        )

        RecentActivity.objects.create(
            username=user.username,
            platform="referral",
            message=(
                f"@{user.username} earned "
                f"£{referee_reward} referral bonus"
            ),
            amount=referee_reward,
        )

        # ------------------------------------------------------
        # NOTIFICATIONS
        # ------------------------------------------------------

        Notification.objects.create(
            user=referrer,
            title="Referral Reward Earned",
            message=(
                f"You earned £{referrer_reward} because "
                f"{user.username} activated membership."
            ),
        )

        Notification.objects.create(
            user=user,
            title="Referral Bonus Earned",
            message=(
                f"You earned £{referee_reward} for activating "
                "membership through a referral."
            ),
        )

        # ------------------------------------------------------
        # REFERRER EMAIL
        # ------------------------------------------------------

        send_account_email(
            user=referrer,
            subject="You earned a SQUEEB referral reward",
            heading="Referral reward credited",
            message=(
                f"{user.username} activated SQUEEB Membership "
                "using your referral."
            ),
            details=[
                {
                    "label": "Referral reward",
                    "value": f"£{referrer_reward}",
                },
                {
                    "label": "New wallet balance",
                    "value": f"£{referrer.balance}",
                },
            ],
        )

        # ------------------------------------------------------
        # REFERRED USER EMAIL
        # ------------------------------------------------------

        send_account_email(
            user=user,
            subject="Your SQUEEB referral bonus was credited",
            heading="Referral bonus credited",
            message=(
                "You received a referral bonus after activating "
                "your SQUEEB Membership."
            ),
            details=[
                {
                    "label": "Referral bonus",
                    "value": f"£{referee_reward}",
                },
                {
                    "label": "New wallet balance",
                    "value": f"£{user.balance}",
                },
            ],
        )

    # ----------------------------------------------------------
    # MEMBERSHIP ACTIVATED NOTIFICATION
    # ----------------------------------------------------------

    Notification.objects.create(
        user=user,
        title="Membership Activated",
        message=(
            "Your SQUEEB membership has been activated successfully."
        ),
    )

    # Send this after referral processing so the email shows
    # the user's final balance.
    send_account_email(
        user=user,
        subject="Your SQUEEB membership is active",
        heading="Membership activated",
        message=(
            "Your membership has been activated successfully. "
            "You can now make future withdrawals with a reduced 10% fee."
        ),
        details=[
            {
                "label": "Membership fee",
                "value": f"£{membership_fee}",
            },
            {
                "label": "Withdrawal fee",
                "value": "10%",
            },
            {
                "label": "Referral bonus",
                "value": (
                    f"£{referee_reward_paid}"
                    if referral_reward_paid
                    else "Not applicable"
                ),
            },
            {
                "label": "New wallet balance",
                "value": f"£{user.balance}",
            },
        ],
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Membership activated successfully.",
            "new_balance": str(user.balance),
            "is_member": True,
            "referral_reward_paid": referral_reward_paid,
            "referral_bonus": (
                str(referee_reward_paid)
                if referral_reward_paid
                else "0.00"
            ),
        }
    )


@login_required
def more_page(request):
    return render(request, "accounts/dashboard/more.html")

from django.utils import timezone
from .models import Task, AdminCampaign


@login_required
def earnings(request):
    today = timezone.now().date()

    campaigns = AdminCampaign.objects.filter(
        status="active",
        start_date__lte=today,
        end_date__gte=today,
    ).order_by("-created_at")

    tasks = Task.objects.filter(
        available__gt=0
    ).order_by("-created_at")

    return render(request, "accounts/dashboard/earnings.html", {
        "campaigns": campaigns,
        "tasks": tasks,
    })