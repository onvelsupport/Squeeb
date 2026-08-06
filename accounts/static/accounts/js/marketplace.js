document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       PRODUCT CARD CLICK
    ========================================================== */

    document
        .querySelectorAll(".clickable-product")
        .forEach(card => {

            card.addEventListener("click", () => {

                const url = card.dataset.url;

                if (url) {
                    window.location.href = url;
                }

            });

        });


    /* ==========================================================
       PREVENT CARD OPEN WHEN CLICKING BUTTONS/LINKS
    ========================================================== */

    document
        .querySelectorAll(".stop-card-click")
        .forEach(element => {

            element.addEventListener("click", event => {
                event.stopPropagation();
            });

        });


    /* ==========================================================
       DELETE PRODUCT CONFIRMATION
    ========================================================== */

    document
        .querySelectorAll(".delete-product")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.stopPropagation();

                const confirmed = window.confirm(
                    "Are you sure you want to delete this product?"
                );

                if (!confirmed) {
                    event.preventDefault();
                }

            });

        });

});