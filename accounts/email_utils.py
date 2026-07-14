from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


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

    email.attach_alternative(
        html_content,
        "text/html",
    )

    try:
        email.send(fail_silently=False)
        return True

    except Exception as error:
        print(
            f"ACCOUNT EMAIL ERROR FOR USER {user.pk}:",
            error,
        )
        return False