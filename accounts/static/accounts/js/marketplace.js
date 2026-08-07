document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* ======================================================
           PRODUCT CARD CLICK
        ====================================================== */

        document
            .querySelectorAll(
                ".clickable-product"
            )
            .forEach(card => {

                card.addEventListener(
                    "click",
                    event => {

                        /*
                         * Don't open the product if somebody
                         * clicked a button/link inside the card.
                         */

                        if (
                            event.target.closest(
                                ".stop-card-click"
                            )
                        ) {
                            return;
                        }


                        const url =
                            card.dataset.url;


                        if (url) {

                            window.location.href =
                                url;

                        }

                    }
                );

            });


        /* ======================================================
           DELETE PRODUCT
        ====================================================== */

        document
            .querySelectorAll(
                ".delete-product"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        const confirmed =
                            window.confirm(
                                "Are you sure you want to delete this product?"
                            );


                        if (!confirmed) {

                            event.preventDefault();

                        }

                    }
                );

            });

    }
);