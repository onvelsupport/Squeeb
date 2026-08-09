"""Authentication helpers for the SQUEEB React Native app.

The website continues to use normal Django sessions. The native app receives a
signed bearer token at login and presents it on API requests. This avoids
relying on WebView/browser cookie persistence in Expo/React Native.
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing

MOBILE_TOKEN_SALT = "squeeb.mobile.auth.v1"
MOBILE_TOKEN_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def issue_mobile_token(user):
    # Including part of the password hash means changing the password
    # automatically invalidates previously-issued app tokens.
    payload = f"{user.pk}:{user.password[-16:]}"
    return signing.dumps(payload, key=settings.SECRET_KEY, salt=MOBILE_TOKEN_SALT, compress=True)


def resolve_mobile_token(token):
    try:
        payload = signing.loads(
            token,
            key=settings.SECRET_KEY,
            salt=MOBILE_TOKEN_SALT,
            max_age=MOBILE_TOKEN_MAX_AGE,
        )
        user_id, password_tail = str(payload).split(":", 1)
        user = get_user_model().objects.get(pk=user_id, is_active=True)
        if user.password[-16:] != password_tail:
            return None
        return user
    except (signing.BadSignature, signing.SignatureExpired, ValueError, get_user_model().DoesNotExist):
        return None


class MobileBearerAuthenticationMiddleware:
    """Attach a valid mobile bearer-token user to request.user.

    Must run after Django's AuthenticationMiddleware. CSRF enforcement is
    skipped only for requests that presented a valid bearer token, because the
    token is explicit request authentication rather than an ambient browser
    cookie.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        authorization = request.META.get("HTTP_AUTHORIZATION", "")
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
            user = resolve_mobile_token(token)
            if user is not None:
                request.user = user
                request._dont_enforce_csrf_checks = True
        return self.get_response(request)
