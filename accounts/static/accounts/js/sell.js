document.addEventListener("DOMContentLoaded", () => {

    const imageInput = document.getElementById("images");
    const fileName = document.getElementById("fileName");
    const previewGrid = document.getElementById("imagePreviewGrid");
    const uploadZone = document.querySelector(".upload-zone");

    const cropModal = document.getElementById("cropModal");
    const cropImage = document.getElementById("cropImage");
    const saveCropBtn = document.getElementById("saveCropBtn");
    const cancelCropBtn = document.getElementById("cancelCropBtn");
    const cancelCropIcon = document.getElementById("cancelCropIcon");

    const form = document.getElementById("sellForm");

    const titleInput = document.getElementById("title");
    const priceInput = document.getElementById("price");
    const categoryInput = document.getElementById("category");
    const descriptionInput = document.getElementById("description");

    const previewTitle = document.getElementById("previewTitle");
    const previewPrice = document.getElementById("previewPrice");
    const previewCategory = document.getElementById("previewCategory");
    const previewDescription = document.getElementById("previewDescription");
    const previewImage = document.getElementById("livePreviewImage");
    const previewPhotoCount = document.getElementById("previewPhotoCount");

    const descriptionCounter =
        document.getElementById("descriptionCounter");

    let selectedFiles = [];
    let cropper = null;
    let editingIndex = null;


    /* ==========================================================
       LIVE PREVIEW
    ========================================================== */

    titleInput?.addEventListener("input", () => {

        previewTitle.textContent =
            titleInput.value.trim() ||
            "Your product title";

    });


    priceInput?.addEventListener("input", () => {

        const value =
            Number(priceInput.value);

        previewPrice.textContent =
            value > 0
                ? `£${value.toFixed(2)}`
                : "£0.00";

    });


    categoryInput?.addEventListener("change", () => {

        const option =
            categoryInput.options[
                categoryInput.selectedIndex
            ];

        previewCategory.textContent =
            categoryInput.value
                ? option.text
                : "Category";

    });


    descriptionInput?.addEventListener("input", () => {

        previewDescription.textContent =
            descriptionInput.value.trim() ||
            "Your product description will appear here.";

        descriptionCounter.textContent =
            `${descriptionInput.value.length} / 1000`;

    });


    /* ==========================================================
       IMAGES
    ========================================================== */

    imageInput?.addEventListener("change", () => {

        const files =
            Array.from(
                imageInput.files
            ).filter(file =>
                file.type.startsWith("image/")
            );

        selectedFiles = [
            ...selectedFiles,
            ...files
        ];

        updateFileInput();
        renderImages();

    });


    function renderImages() {

        previewGrid.innerHTML = "";

        if (!selectedFiles.length) {

            fileName.textContent =
                "No photos selected";

            previewPhotoCount.textContent =
                "0";

            return;

        }


        fileName.textContent =
            selectedFiles.length === 1
                ? "1 photo selected"
                : `${selectedFiles.length} photos selected`;


        previewPhotoCount.textContent =
            selectedFiles.length;


        selectedFiles.forEach(
            (file, index) => {

                const reader =
                    new FileReader();


                reader.onload = event => {

                    if (index === 0) {
                        previewImage.src =
                            event.target.result;
                    }


                    const card =
                        document.createElement("div");


                    card.className =
                        "preview-card";


                    card.innerHTML = `
                        <div class="preview-image">
                            <img
                                src="${event.target.result}"
                                alt="Product photo"
                            >
                        </div>

                        <div class="preview-actions">

                            <button
                                type="button"
                                class="edit-img-btn"
                                data-index="${index}"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="remove-img-btn"
                                data-index="${index}"
                            >
                                Remove
                            </button>

                        </div>
                    `;


                    previewGrid.appendChild(card);

                };


                reader.readAsDataURL(file);

            }
        );

    }


    /* ==========================================================
       PREVIEW BUTTON ACTIONS
    ========================================================== */

    previewGrid?.addEventListener(
        "click",
        event => {

            const editButton =
                event.target.closest(
                    ".edit-img-btn"
                );


            const removeButton =
                event.target.closest(
                    ".remove-img-btn"
                );


            if (editButton) {

                editingIndex =
                    Number(
                        editButton.dataset.index
                    );

                openCropModal(
                    selectedFiles[
                        editingIndex
                    ]
                );

            }


            if (removeButton) {

                const index =
                    Number(
                        removeButton.dataset.index
                    );


                selectedFiles.splice(
                    index,
                    1
                );


                updateFileInput();
                renderImages();

            }

        }
    );


    /* ==========================================================
       CROP
    ========================================================== */

    function openCropModal(file) {

        if (!file) {
            return;
        }


        const reader =
            new FileReader();


        reader.onload = event => {

            cropImage.src =
                event.target.result;


            cropModal.classList.add(
                "show"
            );


            document.body.classList.add(
                "crop-open"
            );


            cropper?.destroy();


            cropper =
                new Cropper(
                    cropImage,
                    {
                        viewMode: 1,
                        autoCropArea: 1,
                        responsive: true,
                        movable: true,
                        zoomable: true,
                        rotatable: true,
                        scalable: true,
                        background: false
                    }
                );

        };


        reader.readAsDataURL(file);

    }


    saveCropBtn?.addEventListener(
        "click",
        () => {

            if (
                !cropper ||
                editingIndex === null
            ) {
                return;
            }


            const canvas =
                cropper.getCroppedCanvas({
                    maxWidth: 1600,
                    maxHeight: 1600,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: "high"
                });


            canvas.toBlob(
                blob => {

                    if (!blob) {
                        return;
                    }


                    const oldFile =
                        selectedFiles[
                            editingIndex
                        ];


                    selectedFiles[
                        editingIndex
                    ] = new File(
                        [blob],
                        oldFile.name,
                        {
                            type: "image/jpeg",
                            lastModified:
                                Date.now()
                        }
                    );


                    updateFileInput();
                    renderImages();
                    closeCropModal();

                },
                "image/jpeg",
                .9
            );

        }
    );


    cancelCropBtn?.addEventListener(
        "click",
        closeCropModal
    );


    cancelCropIcon?.addEventListener(
        "click",
        closeCropModal
    );


    cropModal?.addEventListener(
        "click",
        event => {

            if (
                event.target === cropModal
            ) {
                closeCropModal();
            }

        }
    );


    function closeCropModal() {

        cropModal.classList.remove(
            "show"
        );


        document.body.classList.remove(
            "crop-open"
        );


        cropper?.destroy();

        cropper = null;
        editingIndex = null;

        cropImage.src = "";

    }


    /* ==========================================================
       DRAG DROP
    ========================================================== */

    uploadZone?.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            uploadZone.classList.add(
                "dragging"
            );

        }
    );


    uploadZone?.addEventListener(
        "dragleave",
        () => {

            uploadZone.classList.remove(
                "dragging"
            );

        }
    );


    uploadZone?.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            uploadZone.classList.remove(
                "dragging"
            );


            const files =
                Array.from(
                    event.dataTransfer.files
                ).filter(file =>
                    file.type.startsWith(
                        "image/"
                    )
                );


            selectedFiles = [
                ...selectedFiles,
                ...files
            ];


            updateFileInput();
            renderImages();

        }
    );


    /* ==========================================================
       DATA TRANSFER
    ========================================================== */

    function updateFileInput() {

        const transfer =
            new DataTransfer();


        selectedFiles.forEach(
            file => {

                transfer.items.add(
                    file
                );

            }
        );


        imageInput.files =
            transfer.files;

    }


    /* ==========================================================
       FORMAT PRICE
    ========================================================== */

    priceInput?.addEventListener(
        "blur",
        () => {

            if (
                priceInput.value &&
                !Number.isNaN(
                    Number(priceInput.value)
                )
            ) {

                priceInput.value =
                    Number(
                        priceInput.value
                    ).toFixed(2);

            }

        }
    );


    /* ==========================================================
       VALIDATION
    ========================================================== */

    form?.addEventListener(
        "submit",
        event => {

            if (
                !titleInput.value.trim()
            ) {

                event.preventDefault();

                alert(
                    "Please enter a product title."
                );

                return;

            }


            if (
                Number(priceInput.value) <= 0
            ) {

                event.preventDefault();

                alert(
                    "Please enter a valid price."
                );

                return;

            }


            if (!categoryInput.value) {

                event.preventDefault();

                alert(
                    "Please choose a category."
                );

                return;

            }


            if (
                selectedFiles.length === 0
            ) {

                event.preventDefault();

                alert(
                    "Please upload at least one product photo."
                );

                return;

            }


            updateFileInput();

        }
    );

});