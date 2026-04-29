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
    demo_withdraw,
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
)


urlpatterns = [

    # ======================
    # PUBLIC HTML PAGES
    # ======================
    path("", homepage, name="homepage"),
    path("about/", about, name="about_page"),

    path("login/", login_page, name="login_page"),
    path("signup/", signup_page, name="signup_page"),
    path("earnings/", earnings, name="earnings"),

    # ======================
    # PROTECTED DASHBOARD
    # ======================
    path("dashboard/", dashboard, name="dashboard"),

    # ======================
    # AUTH API
    # ======================
    path("api/signup/", signup, name="signup_api"),
    path("api/login/", login_user, name="login_api"),
    path("api/logout/", logout_user, name="logout_api"),

    path("market/", marketplace_page, name="marketplace"),
    path("sell/", sell_product, name="sell_product"),

    # ======================
    # USER DATA API
    # ======================
    path("api/user-info/", user_info, name="user_info_api"),

    # REAL STRIPE FUNDING
    path("api/create-funding-checkout/", create_funding_checkout, name="create_funding_checkout"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),

    # Withdraw (still disabled safely)
    path("api/demo-withdraw/", demo_withdraw, name="demo_withdraw_api"),

    path("delete-product/<int:product_id>/", delete_product, name="delete_product"),
    path("edit-product/<int:product_id>/", edit_product, name="edit_product"),
    path("pay-membership/", pay_membership, name="pay_membership"),

    # ======================
    # CART
    # ======================
    path("cart/", cart_page, name="cart_page"),
    path("cart/add/<int:product_id>/", add_to_cart, name="add_to_cart"),
    path("cart/remove/<int:product_id>/", remove_from_cart, name="remove_from_cart"),

    path("product/<int:product_id>/sold/", mark_as_sold, name="mark_as_sold"),
    path("seller/history/", seller_history, name="seller_history"),

    # ======================
    # TASK APIs
    # ======================
    path("api/tasks/", get_tasks, name="tasks_api"),
    path("create-task/", create_task, name="create_task"),
    path("api/complete-task/<int:task_id>/", complete_task, name="complete_task"),
    path("api/task/<int:task_id>/", get_single_task, name="get_single_task"),

    path("more/", more_page, name="more_page"),

    # ======================
    # PASSWORD RESET
    # ======================
    path("forgot-password/", forgot_password_page, name="forgot_password_page"),
    path("api/forgot-password/", forgot_password_api, name="forgot_password_api"),
]