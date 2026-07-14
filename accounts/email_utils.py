import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


def send_account_email(
    *,
    user,
    subject,
    heading,
    message,
    details=None,
    action_url=None,
    action_text=None,
):
    if not user or not user.email:
        return False

    context = {
        "user": user,
        "heading": heading,
        "message": message,
        "details": details or [],
        "action_url": action_url,
        "action_text": action_text,
    }

    text_content = render_to_string(
        "accounts/emails/account_notification.txt",
        context,
    )

    html_content = render_to_string(
        "accounts/emails/account_notification.html",
        context,
    )

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )

    email.attach_alternative(html_content, "text/html")

    try:
        email.send(fail_silently=False)
        return True
    except Exception:
        logger.exception(
            "Account email failed for user %s",
            getattr(user, "pk", "unknown"),
        )
        return False


def send_newsletter_email(
    *,
    newsletter,
    user,
    recipient_email=None,
    is_test=False,
):
    email_address = recipient_email or getattr(user, "email", "")

    if not email_address:
        return False

    context = {
        "user": user,
        "newsletter": newsletter,
        "is_test": is_test,
    }

    text_content = render_to_string(
        "accounts/emails/newsletter.txt",
        context,
    )

    html_content = render_to_string(
        "accounts/emails/newsletter.html",
        context,
    )

    subject = newsletter.subject

    if is_test:
        subject = f"[TEST] {subject}"

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_address],
    )

    email.attach_alternative(html_content, "text/html")

    try:
        email.send(fail_silently=False)
        return True
    except Exception:
        logger.exception(
            "Newsletter %s failed for recipient %s",
            newsletter.pk,
            email_address,
        )
        return False
