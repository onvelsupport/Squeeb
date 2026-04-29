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
        "sort_code",
        "account_number",
        "status",
        "requested_at",
        "updated_at",
    )

    list_filter = ("status", "requested_at")
    search_fields = (
        "user__username",
        "user__email",
        "account_number",
        "sort_code",
    )

    ordering = ("-requested_at",)

    readonly_fields = (
        "requested_at",
        "updated_at",
    )

    actions = ["mark_as_approved", "mark_as_paid", "mark_as_rejected"]

    @admin.action(description="Mark selected withdrawals as APPROVED")
    def mark_as_approved(self, request, queryset):
        queryset.update(status="approved")

    @admin.action(description="Mark selected withdrawals as PAID")
    def mark_as_paid(self, request, queryset):
        queryset.update(status="paid")

    @admin.action(description="Mark selected withdrawals as REJECTED")
    def mark_as_rejected(self, request, queryset):
        queryset.update(status="rejected")