from django.conf import settings
from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone

from .email_utils import send_newsletter_email
from .models import (
    Task,
    User,
    WithdrawalRequest,
    AdminCampaign,
    CampaignSubmission,
    Newsletter,
)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "cost_per_action",
        "worker_reward",
        "available",
        "platforms",
        "creator",
        "created_at",
    )


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "email",
        "is_member",
        "balance",
        "earnings",
        "tasks_completed",
    )
    list_filter = ("is_member",)


@admin.register(WithdrawalRequest)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "amount",
        "method",
        "status",
        "created_at",
        "paid_at",
    )
    list_filter = ("status", "method", "created_at")
    search_fields = (
        "user__username",
        "user__email",
        "account_name",
        "bank_name",
        "sort_code",
        "account_number",
        "paypal_email",
    )
    ordering = ("-created_at",)
    readonly_fields = ("approval_token", "created_at", "paid_at")
    actions = ["mark_as_paid", "mark_as_rejected"]

    @admin.action(description="Mark selected withdrawals as PAID")
    def mark_as_paid(self, request, queryset):
        queryset.update(status="paid")

    @admin.action(description="Mark selected withdrawals as REJECTED")
    def mark_as_rejected(self, request, queryset):
        queryset.update(status="rejected")


@admin.register(AdminCampaign)
class AdminCampaignAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "platform",
        "reward",
        "participants",
        "max_participants",
        "status",
        "start_date",
        "end_date",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "platform")
    search_fields = ("title", "description")
    ordering = ("-created_at",)
    readonly_fields = ("participants", "created_at")


@admin.register(CampaignSubmission)
class CampaignSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "campaign",
        "user",
        "status",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("status", "campaign")
    search_fields = ("user__username", "campaign__title")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "reviewed_at")
    actions = ["approve_submissions", "reject_submissions"]

    @admin.action(description="Approve selected submissions")
    def approve_submissions(self, request, queryset):
        for submission in queryset.filter(status="pending"):
            submission.status = "approved"
            submission.reviewed_at = timezone.now()
            submission.save()

    @admin.action(description="Reject selected submissions")
    def reject_submissions(self, request, queryset):
        for submission in queryset.filter(status="pending"):
            submission.status = "rejected"
            submission.reviewed_at = timezone.now()
            submission.save()


@admin.register(Newsletter)
class NewsletterAdmin(admin.ModelAdmin):
    list_display = (
        "subject",
        "audience",
        "status",
        "sent_count",
        "failed_count",
        "skipped_count",
        "created_by",
        "created_at",
        "sent_at",
    )
    list_filter = ("audience", "status", "created_at")
    search_fields = ("subject", "heading", "message")
    ordering = ("-created_at",)
    readonly_fields = (
        "status",
        "sent_count",
        "failed_count",
        "skipped_count",
        "created_by",
        "created_at",
        "sent_at",
    )
    actions = ["send_selected_newsletters", "send_test_to_admin"]

    fieldsets = (
        (
            "Email content",
            {
                "fields": (
                    "subject",
                    "heading",
                    "message",
                    "action_text",
                    "action_url",
                )
            },
        ),
        ("Recipients", {"fields": ("audience",)}),
        (
            "Delivery information",
            {
                "fields": (
                    "status",
                    "sent_count",
                    "failed_count",
                    "skipped_count",
                    "created_by",
                    "created_at",
                    "sent_at",
                )
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="Send selected newsletter")
    def send_selected_newsletters(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                "Select exactly one newsletter to send.",
                level=messages.ERROR,
            )
            return

        newsletter = queryset.first()

        with transaction.atomic():
            newsletter = Newsletter.objects.select_for_update().get(
                pk=newsletter.pk
            )

            if newsletter.status in {"sending", "sent"}:
                self.message_user(
                    request,
                    "This newsletter is already sending or has already been sent.",
                    level=messages.ERROR,
                )
                return

            newsletter.status = "sending"
            newsletter.sent_count = 0
            newsletter.failed_count = 0
            newsletter.skipped_count = 0
            newsletter.save(
                update_fields=[
                    "status",
                    "sent_count",
                    "failed_count",
                    "skipped_count",
                ]
            )

        sent_count = 0
        failed_count = 0
        skipped_count = 0

        for user in newsletter.get_recipients().iterator(chunk_size=100):
            if not user.email:
                skipped_count += 1
                continue

            was_sent = send_newsletter_email(
                newsletter=newsletter,
                user=user,
            )

            if was_sent:
                sent_count += 1
            else:
                failed_count += 1

        newsletter.sent_count = sent_count
        newsletter.failed_count = failed_count
        newsletter.skipped_count = skipped_count
        newsletter.sent_at = timezone.now()
        newsletter.status = "sent" if failed_count == 0 else "failed"
        newsletter.save(
            update_fields=[
                "sent_count",
                "failed_count",
                "skipped_count",
                "sent_at",
                "status",
            ]
        )

        level = messages.SUCCESS if failed_count == 0 else messages.WARNING

        self.message_user(
            request,
            (
                f"Newsletter finished. Sent: {sent_count}, "
                f"failed: {failed_count}, skipped: {skipped_count}."
            ),
            level=level,
        )

    @admin.action(description="Send test copy to the admin email")
    def send_test_to_admin(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                "Select exactly one newsletter for a test email.",
                level=messages.ERROR,
            )
            return

        newsletter = queryset.first()
        test_email = getattr(settings, "ADMIN_EMAIL", request.user.email)

        if not test_email:
            self.message_user(
                request,
                "No ADMIN_EMAIL or admin account email is configured.",
                level=messages.ERROR,
            )
            return

        was_sent = send_newsletter_email(
            newsletter=newsletter,
            user=request.user,
            recipient_email=test_email,
            is_test=True,
        )

        if was_sent:
            self.message_user(
                request,
                f"Test email sent to {test_email}.",
                level=messages.SUCCESS,
            )
        else:
            self.message_user(
                request,
                f"The test email to {test_email} failed.",
                level=messages.ERROR,
            )
