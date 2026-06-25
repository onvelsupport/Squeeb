document.addEventListener("DOMContentLoaded", () => {

    /* ================= REMOVE ITEM CONFIRMATION ================= */

    document.querySelectorAll(".remove-btn").forEach(button => {

        button.addEventListener("click", function (e) {

            const confirmed = confirm(
                "Remove this item from your cart?"
            );

            if (!confirmed) {
                e.preventDefault();
            }

        });

    });

    /* ================= CHECKOUT BUTTON ================= */

    const checkoutBtn = document.querySelector(".checkout-btn");

    checkoutBtn?.addEventListener("click", () => {

        alert(
            "Checkout page coming soon."
        );

        /*
        window.location.href = "/checkout/";
        */

    });

});