from django.contrib import admin
from .models import Task, User


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "payout", "available", "platforms", "creator", "created_at")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "is_member", "balance", "earnings", "tasks_completed")

    list_filter = ("is_member",)

@admin.action(description="Cancel selected users membership")
def cancel_membership(self, request, queryset):
    queryset.update(is_member=False)

actions = ["cancel_membership"]
