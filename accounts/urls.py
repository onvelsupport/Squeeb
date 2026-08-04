from django.contrib.auth import views as auth_views
from django.urls import path

from .views import (
    about,
    acceptable_use,
    add_to_cart,
    admin_campaigns,
    admin_create_campaign,
    admin_create_campaign_page,
    api_edit_profile,
    approve_task_completion,
    approve_withdrawal,
    bank_details,
    cart_page,
    cookie_policy,
    complete_task,
    create_cart_checkout,
    create_funding_checkout,
    create_task,
    dashboard,
    delete_product,
    earnings,
    edit_product,
    edit_profile,
    forgot_password_api,
    forgot_password_page,
    gbp_ngn_exchange_rate,
    get_campaign,
    get_single_task,
    get_tasks,
    global_search,
    homepage,
    login_page,
    login_user,
    logout_user,
    marketplace_page,
    mark_as_sold,
    mark_notifications_read,
    more_page,
    my_task_submissions_api,
    my_tasks,
    my_tasks_api,
    notifications,
    notifications_api,
    pay_membership,
    privacy_policy,
    product_detail,
    public_user_profile,
    recent_activities_api,
    referrals_api,
    referrals_page,
    refund_policy,
    reject_task_completion,
    remove_from_cart,
    request_withdrawal,
    root_redirect,
    sell_product,
    seller_history,
    send_product_message,
    signup,
    signup_page,
    squeeb_admin_dashboard,
    stripe_webhook,
    submit_campaign,
    support_page,
    task_submission_reviews,
    task_submission_reviews_api,
    terms_conditions,
    toggle_follow,
    transaction_history,
    transaction_history_api,
    user_info,
    verify_bank_transfer,
    withdrawal_history_api,
    withdrawals,
    admin_campaign_submissions,
    approve_campaign_submission,
    reject_campaign_submission,
    influencer_terms,
)


urlpatterns = [
    # ==========================================================
    # PUBLIC PAGES
    # ==========================================================

    path("", root_redirect, name="root"),
    path("home/", homepage, name="home"),
    path("about/", about, name="about"),
    path("support/", support_page, name="support"),

    # ==========================================================
    # AUTHENTICATION PAGES
    # ==========================================================

    path("login/", login_page, name="login"),
    path("signup/", signup_page, name="signup"),
    path("logout/", logout_user, name="logout"),

    path(
        "forgot-password/",
        forgot_password_page,
        name="forgot_password",
    ),

    # ==========================================================
    # AUTHENTICATION APIs
    # ==========================================================

    path(
        "api/signup/",
        signup,
        name="signup_api",
    ),

    path(
        "api/login/",
        login_user,
        name="login_api",
    ),

    path(
        "api/logout/",
        logout_user,
        name="logout_api",
    ),

    path(
        "api/forgot-password/",
        forgot_password_api,
        name="forgot_password_api",
    ),

    # ==========================================================
    # PASSWORD RESET
    # ==========================================================

    path(
        "password-reset-sent/",
        auth_views.PasswordResetDoneView.as_view(
            template_name="accounts/auth/password_reset_sent.html"
        ),
        name="password_reset_done",
    ),

    path(
        "reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(
            template_name="accounts/auth/password_reset_confirm.html"
        ),
        name="password_reset_confirm",
    ),

    path(
        "password-reset-complete/",
        auth_views.PasswordResetCompleteView.as_view(
            template_name="accounts/auth/password_reset_complete.html"
        ),
        name="password_reset_complete",
    ),

    # ==========================================================
    # USER DASHBOARD
    # ==========================================================

    path(
        "dashboard/",
        dashboard,
        name="dashboard",
    ),

    path(
        "earnings/",
        earnings,
        name="earnings",
    ),

    path(
        "withdrawals/",
        withdrawals,
        name="withdrawals",
    ),

    path(
        "more/",
        more_page,
        name="more_page",
    ),

    path(
        "more/edit-profile/",
        edit_profile,
        name="edit_profile",
    ),

    path(
        "more/bank-details/",
        bank_details,
        name="bank_details",
    ),

    path(
        "more/my-tasks/",
        my_tasks,
        name="my_tasks",
    ),

    path(
        "referrals/",
        referrals_page,
        name="referrals_page",
    ),

    path(
        "notifications/",
        notifications,
        name="notifications",
    ),

    path(
        "transaction-history/",
        transaction_history,
        name="transaction_history",
    ),

    # ==========================================================
    # USER DATA APIs
    # ==========================================================

    path(
        "api/user-info/",
        user_info,
        name="user_info_api",
    ),

    path(
        "api/edit-profile/",
        api_edit_profile,
        name="api_edit_profile",
    ),

    path(
        "api/search/",
        global_search,
        name="global_search",
    ),

    path(
        "api/recent-activities/",
        recent_activities_api,
        name="recent_activities_api",
    ),

    path(
        "api/referrals/",
        referrals_api,
        name="referrals_api",
    ),

    path(
        "api/notifications/",
        notifications_api,
        name="notifications_api",
    ),

    path(
        "api/notifications/read/",
        mark_notifications_read,
        name="mark_notifications_read",
    ),

    path(
        "api/transaction-history/",
        transaction_history_api,
        name="transaction_history_api",
    ),


    path(
    "influencer-terms/",
    influencer_terms,
    name="influencer_terms",
),

    # ==========================================================
    # USER PROFILES AND FOLLOWING
    # ==========================================================

    path(
        "user/<str:username>/",
        public_user_profile,
        name="public_user_profile",
    ),

    path(
        "api/follow/<str:username>/",
        toggle_follow,
        name="toggle_follow",
    ),

    # ==========================================================
    # NORMAL ADVERTISER TASKS
    # ==========================================================

    path(
        "api/tasks/",
        get_tasks,
        name="tasks_api",
    ),

    path(
        "api/task/<int:task_id>/",
        get_single_task,
        name="get_single_task",
    ),

    path(
        "create-task/",
        create_task,
        name="create_task",
    ),

    path(
        "api/complete-task/<int:task_id>/",
        complete_task,
        name="complete_task",
    ),

    path(
        "api/my-tasks/",
        my_tasks_api,
        name="my_tasks_api",
    ),

    path(
        "api/my-task-submissions/",
        my_task_submissions_api,
        name="my_task_submissions_api",
    ),

    path(
        "my-tasks/<int:task_id>/reviews/",
        task_submission_reviews,
        name="task_submission_reviews",
    ),

    path(
        "api/my-tasks/<int:task_id>/reviews/",
        task_submission_reviews_api,
        name="task_submission_reviews_api",
    ),

    path(
        "task-completions/<int:completion_id>/approve/",
        approve_task_completion,
        name="approve_task_completion",
    ),

    path(
        "task-completions/<int:completion_id>/reject/",
        reject_task_completion,
        name="reject_task_completion",
    ),

    # ==========================================================
    # SQUEEB ADMIN DASHBOARD
    # ==========================================================

    path(
        "squeeb-admin/",
        squeeb_admin_dashboard,
        name="squeeb_admin_dashboard",
    ),

    path(
        "squeeb-admin/campaigns/",
        admin_campaigns,
        name="admin_campaigns",
    ),

    path(
        "squeeb-admin/campaigns/create/",
        admin_create_campaign_page,
        name="admin_create_campaign_page",
    ),

    # ==========================================================
    # SQUEEB ADMIN CAMPAIGN API
    # ==========================================================

    path(
        "api/admin/create-campaign/",
        admin_create_campaign,
        name="admin_create_campaign",
    ),

    path(
    "squeeb-admin/campaign-submissions/",
    admin_campaign_submissions,
    name="admin_campaign_submissions",
),

path(
    "squeeb-admin/campaign-submissions/<int:submission_id>/approve/",
    approve_campaign_submission,
    name="approve_campaign_submission",
),

path(
    "squeeb-admin/campaign-submissions/<int:submission_id>/reject/",
    reject_campaign_submission,
    name="reject_campaign_submission",
),


    # ==========================================================
    # USER CAMPAIGN APIs
    # ==========================================================

    path(
        "api/campaign/<int:campaign_id>/",
        get_campaign,
        name="get_campaign",
    ),

    path(
        "api/campaign/<int:campaign_id>/submit/",
        submit_campaign,
        name="submit_campaign",
    ),

    # ==========================================================
    # MEMBERSHIP
    # ==========================================================

    path(
        "pay-membership/",
        pay_membership,
        name="pay_membership",
    ),

    # ==========================================================
    # MARKETPLACE
    # ==========================================================

    path(
        "market/",
        marketplace_page,
        name="marketplace",
    ),

    path(
        "sell/",
        sell_product,
        name="sell",
    ),

    path(
        "seller/history/",
        seller_history,
        name="seller_history",
    ),

    path(
        "product/<int:product_id>/edit/",
        edit_product,
        name="edit_product",
    ),

    path(
        "product/<int:product_id>/sold/",
        mark_as_sold,
        name="mark_as_sold",
    ),

    path(
        "delete-product/<int:product_id>/",
        delete_product,
        name="delete_product",
    ),

    path(
        "marketplace/product/<int:product_id>/",
        product_detail,
        name="product_detail",
    ),

    path(
        "marketplace/product/<int:product_id>/message/",
        send_product_message,
        name="send_product_message",
    ),

    # ==========================================================
    # SHOPPING CART
    # ==========================================================

    path(
        "cart/",
        cart_page,
        name="cart",
    ),

    path(
        "cart/add/<int:product_id>/",
        add_to_cart,
        name="add_to_cart",
    ),

    path(
        "cart/remove/<int:product_id>/",
        remove_from_cart,
        name="remove_from_cart",
    ),

    path(
        "cart/create-checkout/",
        create_cart_checkout,
        name="create_cart_checkout",
    ),

    # ==========================================================
    # WALLET FUNDING
    # ==========================================================

    path(
        "api/create-funding-checkout/",
        create_funding_checkout,
        name="create_funding_checkout",
    ),

    path(
        "stripe/webhook/",
        stripe_webhook,
        name="stripe_webhook",
    ),

    path(
        "verify-bank-transfer/<int:payment_id>/",
        verify_bank_transfer,
        name="verify_bank_transfer",
    ),

    # ==========================================================
    # WITHDRAWALS
    # ==========================================================

    path(
        "request-withdrawal/",
        request_withdrawal,
        name="request_withdrawal",
    ),

    path(
        "approve-withdrawal/<uuid:token>/",
        approve_withdrawal,
        name="approve_withdrawal",
    ),

    path(
        "api/withdrawal-history/",
        withdrawal_history_api,
        name="withdrawal_history_api",
    ),

    path(
        "api/exchange-rate/gbp-ngn/",
        gbp_ngn_exchange_rate,
        name="gbp_ngn_exchange_rate",
    ),

    # ==========================================================
    # LEGAL PAGES
    # ==========================================================

    path(
        "privacy-policy/",
        privacy_policy,
        name="privacy_policy",
    ),

    path(
        "terms-and-conditions/",
        terms_conditions,
        name="terms_conditions",
    ),

    path(
        "refund-policy/",
        refund_policy,
        name="refund_policy",
    ),

    path(
        "cookie-policy/",
        cookie_policy,
        name="cookie_policy",
    ),

    path(
        "acceptable-use/",
        acceptable_use,
        name="acceptable_use",
    ),
]