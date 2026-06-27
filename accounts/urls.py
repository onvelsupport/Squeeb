from django.urls import path
from .views import (
    homepage,
    about,
    login_page,
    signup_page,
    signup,
    login_user,
    logout_user,
    dashboard,
    user_info,
    get_tasks,
    more_page,
    forgot_password_page,
    forgot_password_api,
    create_funding_checkout,
    stripe_webhook,
    request_withdrawal,
    marketplace_page,
    sell_product,
    delete_product,
    cart_page,
    add_to_cart,
    remove_from_cart,
    edit_product,
    mark_as_sold,
    seller_history,
    earnings,
    create_task,
    pay_membership,
    complete_task,
    get_single_task,
    support_page,
    withdrawals,
    global_search,
    public_user_profile,
    toggle_follow,
    recent_activities_api,
    notifications,
    create_cart_checkout,
    edit_product,
    product_detail,
    send_product_message,
    root_redirect,
    edit_profile,
    bank_details,
    my_tasks,
)

urlpatterns = [
    # ======================
    # PUBLIC PAGES
    # ======================
    path("", root_redirect, name="root"),
    path("home/", homepage, name="home"),

    path("about/", about, name="about"),
    path("about/", about, name="about_page"),

    path("support/", support_page, name="support"),
    path("support/", support_page, name="support_page"),

    path("login/", login_page, name="login"),
    path("login/", login_page, name="login_page"),

    path("signup/", signup_page, name="signup"),
    path("signup/", signup_page, name="signup_page"),

    path("logout/", logout_user, name="logout"),

    path("forgot-password/", forgot_password_page, name="forgot_password"),
    path("forgot-password/", forgot_password_page, name="forgot_password_page"),

    # ======================
    # DASHBOARD
    # ======================
    path("dashboard/", dashboard, name="dashboard"),
    path("more/", more_page, name="more_page"),
    path("earnings/", earnings, name="earnings"),
    path("withdrawals/", withdrawals, name="withdrawals"),
    path("api/search/", global_search, name="global_search"),
    path("notifications/", notifications, name="notifications"),
    path("more/edit-profile/", edit_profile, name="edit_profile"),
    path("more/bank-details/", bank_details, name="bank_details"),
    path("more/my-tasks/", my_tasks, name="my_tasks"),

    # ======================
    # USER PROFILE
    # ======================
    path("user/<str:username>/", public_user_profile, name="public_user_profile"),
    path("api/follow/<str:username>/", toggle_follow, name="toggle_follow"),

    # ======================
    # MARKETPLACE
    # ======================
    path("market/", marketplace_page, name="marketplace"),
    path("sell/", sell_product, name="sell"),
      path("seller/history/", seller_history, name="seller_history"),

    path("cart/", cart_page, name="cart"),
    path("cart/add/<int:product_id>/", add_to_cart, name="add_to_cart"),
    path("cart/remove/<int:product_id>/", remove_from_cart, name="remove_from_cart"),
    path("cart/create-checkout/",create_cart_checkout, name="create_cart_checkout"),

    path("delete-product/<int:product_id>/", delete_product, name="delete_product"),
    path("product/<int:product_id>/edit/", edit_product, name="edit_product"),
    path("product/<int:product_id>/sold/", mark_as_sold, name="mark_as_sold"),
    path("marketplace/product/<int:product_id>/", product_detail,name="product_detail",),
    path("marketplace/product/<int:product_id>/message/",send_product_message, name="send_product_message"),

    # ======================
    # MEMBERSHIP
    # ======================
    path("pay-membership/", pay_membership, name="pay_membership"),

    # ======================
    # AUTH APIs
    # ======================
    path("api/signup/", signup, name="signup_api"),
    path("api/login/", login_user, name="login_api"),
    path("api/logout/", logout_user, name="logout_api"),

    # ======================
    # USER DATA API
    # ======================
    path("api/user-info/", user_info, name="user_info_api"),
    path("api/recent-activities/", recent_activities_api, name="recent_activities_api"),

    # ======================
    # TASKS
    # ======================
    path("api/tasks/", get_tasks, name="tasks_api"),
    path("create-task/", create_task, name="create_task"),
    path("api/complete-task/<int:task_id>/", complete_task, name="complete_task"),
    path("api/task/<int:task_id>/", get_single_task, name="get_single_task"),

    # ======================
    # FUNDING
    # ======================
    path("api/create-funding-checkout/", create_funding_checkout, name="create_funding_checkout"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
    path("api/request-withdrawal/", request_withdrawal, name="request_withdrawal"),

    # ======================
    # PASSWORD RESET API
    # ======================
    path("api/forgot-password/", forgot_password_api, name="forgot_password_api"),
]