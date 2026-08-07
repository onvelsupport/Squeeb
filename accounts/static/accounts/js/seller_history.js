document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       SELL AGAIN
    ========================================================== */

    document
        .querySelectorAll(".relist-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const productId =
                        button.dataset.productId;

                    const productTitle =
                        button.dataset.productTitle
                        || "this product";


                    const confirmed =
                        window.confirm(
                            `Relist "${productTitle}" for sale again?`
                        );


                    if (!confirmed) {
                        return;
                    }


                    /*
                     * Backend relisting isn't wired yet.
                     *
                     * Once we add the endpoint, this button can
                     * POST the product ID and set is_sold=False.
                     */

                    alert(
                        "The Sell Again backend still needs to be connected."
                    );


                    console.log(
                        "Relist product:",
                        productId
                    );

                }
            );

        });

});