document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       PRODUCT IMAGE GALLERY
    ========================================================== */

    const mainImage =
        document.getElementById("mainProductImage");

    const mainPlaceholder =
        document.getElementById("mainImagePlaceholder");

    const thumbnails =
        document.querySelectorAll(".thumbnail-btn");


    thumbnails.forEach(button => {

        button.addEventListener("click", () => {

            const image =
                button.querySelector("img");


            if (
                !image ||
                !mainImage
            ) {
                return;
            }


            mainImage.src =
                image.src;

            mainImage.hidden =
                false;


            if (mainPlaceholder) {
                mainPlaceholder.hidden =
                    true;
            }


            thumbnails.forEach(item => {
                item.classList.remove("active");
            });


            button.classList.add("active");

        });

    });


    /* ==========================================================
       RELATED PRODUCT
    ========================================================== */

    document
        .querySelectorAll(".clickable-product")
        .forEach(card => {

            card.addEventListener("click", () => {

                const url =
                    card.dataset.url;


                if (url) {
                    window.location.href =
                        url;
                }

            });

        });


    /* ==========================================================
       DELETE
    ========================================================== */

    document
        .querySelectorAll(".delete-product")
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

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


    /* ==========================================================
       MESSAGE MODAL
    ========================================================== */

    const messageModal =
        document.getElementById("messageModal");

    const openMessageModal =
        document.getElementById("openMessageModal");

    const closeMessageModal =
        document.getElementById("closeMessageModal");

    const cancelMessageModal =
        document.getElementById("cancelMessageModal");


    function openModal() {

        if (!messageModal) {
            return;
        }


        messageModal.classList.add(
            "show"
        );


        document.body.style.overflow =
            "hidden";


        setTimeout(() => {

            document
                .getElementById("sellerMessage")
                ?.focus();

        }, 100);

    }


    function closeModal() {

        if (!messageModal) {
            return;
        }


        messageModal.classList.remove(
            "show"
        );


        document.body.style.overflow =
            "";

    }


    openMessageModal?.addEventListener(
        "click",
        openModal
    );


    document
        .querySelectorAll("[data-open-message]")
        .forEach(button => {

            button.addEventListener(
                "click",
                openModal
            );

        });


    closeMessageModal?.addEventListener(
        "click",
        closeModal
    );


    cancelMessageModal?.addEventListener(
        "click",
        closeModal
    );


    messageModal?.addEventListener(
        "click",
        event => {

            if (
                event.target === messageModal
            ) {
                closeModal();
            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                messageModal?.classList.contains(
                    "show"
                )
            ) {
                closeModal();
            }

        }
    );

});