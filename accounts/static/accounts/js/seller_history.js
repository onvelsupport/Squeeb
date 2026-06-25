document.addEventListener("DOMContentLoaded", () => {

    /* ================= SELL AGAIN ================= */

    document.querySelectorAll(".relist-btn").forEach(button => {

        button.addEventListener("click", () => {

            alert(
                "This feature will allow you to relist sold products in one click."
            );

            /*
            Future:

            fetch("/relist-product/", {
                method: "POST"
            })

            */

        });

    });

});