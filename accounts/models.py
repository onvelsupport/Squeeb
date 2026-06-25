from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_set"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followers_set"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "following")

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"
    

class User(AbstractUser):
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tasks_completed = models.IntegerField(default=0)
    referrals = models.IntegerField(default=0)
    is_member = models.BooleanField(default=False)


class Task(models.Model):
    creator = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    title = models.CharField(max_length=255)
    cost_per_action = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    worker_reward = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    available = models.IntegerField(default=0)

    icon = models.CharField(max_length=255, default="task.png")
    short_desc = models.CharField(max_length=255, default="")
    platforms = models.CharField(max_length=120, default="")

    TASK_TYPES = (
        ("like", "Like"),
        ("follow", "Follow"),
        ("comment", "Comment"),
        ("subscribe", "Subscribe"),
    )

    task_type = models.CharField(max_length=20, choices=TASK_TYPES, default="follow")
    instructions = models.TextField(default="Follow the task instructions.")
    link = models.URLField(blank=True, null=True)
    total_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    @property
    def platform_profit_per_action(self):
        return self.cost_per_action - self.worker_reward

    @property
    def unit(self):
        units = {
            "follow": "follower",
            "like": "like",
            "comment": "comment",
            "subscribe": "subscriber",
        }
        return units.get(self.task_type, "task")

    @property
    def dynamic_instructions(self):
        instructions_map = {
            "like": [
                "Click the link below.",
                f"Like the post on {self.platforms}.",
                "Take a screenshot as proof.",
            ],
            "follow": [
                "Click the link below.",
                f"Follow the page on {self.platforms}.",
                "Take a screenshot showing you followed.",
            ],
            "comment": [
                "Click the link below.",
                "Leave a genuine comment on the post.",
                "Take a screenshot of your comment.",
            ],
            "subscribe": [
                "Click the link below.",
                "Subscribe to the channel.",
                "Take a screenshot as proof.",
            ],
        }

        return instructions_map.get(self.task_type, [self.instructions])



class RecentActivity(models.Model):
    username = models.CharField(max_length=150)
    platform = models.CharField(max_length=50)
    message = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.message
    


class TaskCompletion(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    proof = models.ImageField(upload_to="task_proofs/", null=True, blank=True)
    approved = models.BooleanField(default=True)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "task")

    def __str__(self):
        return f"{self.user.username} completed {self.task.title}"


class FundingPayment(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="funding_payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_session_id = models.CharField(max_length=255, unique=True, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - £{self.amount} - {self.status}"


class WithdrawalRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("paid", "Paid"),
        ("rejected", "Rejected"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="withdrawal_requests")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    sort_code = models.CharField(max_length=20)
    account_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_note = models.TextField(blank=True, null=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - £{self.amount} - {self.status}"


class Product(models.Model):
    seller = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    image = models.ImageField(upload_to="products/")
    category = models.CharField(max_length=100)
    is_sold = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/")



class Notification(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"
    




class ProductMessage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_product_messages")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_product_messages")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.sender} to {self.receiver} - {self.product.title}"