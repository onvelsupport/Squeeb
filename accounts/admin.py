from django.contrib import admin
from .models import Task, User, WithdrawalRequest


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
