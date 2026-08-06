document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       REMOVE ITEM
    ========================================================== */

    document.querySelectorAll(".remove-btn").forEach(button => {

        button.addEventListener("click", event => {

            const confirmed = window.confirm(
                "Remove this item from your cart?"
            );

            if (!confirmed) {
                event.preventDefault();
            }

        });

    });


    /* ==========================================================
       CHECKOUT
    ========================================================== */

    const checkoutBtn =
        document.querySelector(".checkout-btn");


    checkoutBtn?.addEventListener("click", async () => {

        const originalHTML =
            checkoutBtn.innerHTML;

        try {

            checkoutBtn.disabled = true;

            checkoutBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Redirecting...</span>
            `;


            const response = await fetch(
                "/cart/create-checkout/",
                {
                    method: "POST",

                    credentials:
                        "same-origin",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Checkout failed."
                );

            }


            if (!data.checkout_url) {

                throw new Error(
                    "Checkout URL was not returned."
                );

            }


            window.location.href =
                data.checkout_url;


        } catch (error) {

            console.error(
                "Checkout error:",
                error
            );


            alert(
                error.message ||
                "Unable to start checkout. Please try again."
            );


            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = originalHTML;

        }

    });

});