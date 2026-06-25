document.addEventListener("DOMContentLoaded", () => {

    /* ================= FILE UPLOAD PREVIEW TEXT ================= */

    const imageInput = document.getElementById("images");
    const fileName = document.getElementById("fileName");

    imageInput?.addEventListener("change", () => {

        if (imageInput.files.length === 0) {

            fileName.textContent = "No photos selected";
            return;

        }

        if (imageInput.files.length === 1) {

            fileName.textContent =
                imageInput.files[0].name;

        }

        else {

            fileName.textContent =
                `${imageInput.files.length} photos selected`;

        }

    });


    /* ================= PRICE FORMAT ================= */

    const priceInput = document.getElementById("price");

    priceInput?.addEventListener("blur", () => {

        if (
            priceInput.value &&
            !isNaN(priceInput.value)
        ) {

            priceInput.value =
                parseFloat(priceInput.value)
                .toFixed(2);

        }

    });


    /* ================= CHARACTER COUNTER ================= */

    const description =
        document.getElementById("description");

    if (description) {

        const counter = document.createElement("small");

        counter.style.color = "#64748b";
        counter.style.marginTop = "5px";

        description.parentNode.appendChild(counter);

        function updateCounter() {

            counter.textContent =
                `${description.value.length}/1000 characters`;

        }

        updateCounter();

        description.addEventListener(
            "input",
            updateCounter
        );

    }


    /* ================= FORM VALIDATION ================= */

    const form =
        document.querySelector(".sell-form");

    form?.addEventListener(
        "submit",
        (e) => {

            const title =
                document.getElementById("title").value.trim();

            const price =
                parseFloat(
                    document.getElementById("price").value
                );

            const category =
                document.getElementById("category").value;

            if (!title) {

                e.preventDefault();

                alert(
                    "Please enter a product title."
                );

                return;

            }

            if (!price || price <= 0) {

                e.preventDefault();

                alert(
                    "Please enter a valid price."
                );

                return;

            }

            if (!category) {

                e.preventDefault();

                alert(
                    "Please select a category."
                );

                return;

            }

        }
    );


    /* ================= UPLOAD BOX HOVER ================= */

    const uploadBox =
        document.querySelector(".upload-box");

    uploadBox?.addEventListener(
        "dragover",
        (e) => {

            e.preventDefault();

            uploadBox.style.borderColor =
                "#2563eb";

            uploadBox.style.background =
                "#eff6ff";

        }
    );

    uploadBox?.addEventListener(
        "dragleave",
        () => {

            uploadBox.style.borderColor =
                "#cbd5e1";

            uploadBox.style.background =
                "#f8fafc";

        }
    );

});