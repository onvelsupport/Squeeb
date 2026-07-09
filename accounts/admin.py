from django.contrib import admin
from .models import (
    Task,
    User,
    WithdrawalRequest,
    AdminCampaign,
    CampaignSubmission,
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

    list_filter = (
        "is_member",
    )


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

    list_filter = (
        "status",
        "method",
        "created_at",
    )

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

    readonly_fields = (
        "approval_token",
        "created_at",
        "paid_at",
    )

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

    list_filter = (
        "status",
        "platform",
    )

    search_fields = (
        "title",
        "description",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "participants",
        "created_at",
    )


@admin.register(CampaignSubmission)
class CampaignSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "campaign",
        "user",
        "status",
        "created_at",
        "reviewed_at",
    )

    list_filter = (
        "status",
        "campaign",
    )

    search_fields = (
        "user__username",
        "campaign__title",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "created_at",
        "reviewed_at",
    )

    actions = ["approve_submissions", "reject_submissions"]

    @admin.action(description="Approve selected submissions")
    def approve_submissions(self, request, queryset):
        from django.utils import timezone

        for submission in queryset.filter(status="pending"):
            submission.status = "approved"
            submission.reviewed_at = timezone.now()
            submission.save()

    @admin.action(description="Reject selected submissions")
    def reject_submissions(self, request, queryset):
        from django.utils import timezone

        for submission in queryset.filter(status="pending"):
            submission.status = "rejected"
            submission.reviewed_at = timezone.now()
            submission.save()