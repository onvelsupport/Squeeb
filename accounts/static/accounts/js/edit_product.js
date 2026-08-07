document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const imageInput =
        document.getElementById("images");

    const fileName =
        document.getElementById("fileName");

    const previewGrid =
        document.getElementById("imagePreviewGrid");

    const uploadZone =
        document.querySelector(".upload-zone");


    const cropModal =
        document.getElementById("cropModal");

    const cropImage =
        document.getElementById("cropImage");

    const saveCropBtn =
        document.getElementById("saveCropBtn");

    const cancelCropBtn =
        document.getElementById("cancelCropBtn");

    const cancelCropIcon =
        document.getElementById("cancelCropIcon");


    const titleInput =
        document.getElementById("title");

    const priceInput =
        document.getElementById("price");

    const categoryInput =
        document.getElementById("category");

    const description =
        document.getElementById("description");

    const descriptionCounter =
        document.getElementById("descriptionCounter");

    const form =
        document.getElementById("editProductForm");


    const sidebarTitle =
        document.getElementById("sidebarTitle");

    const sidebarPrice =
        document.getElementById("sidebarPrice");

    const sidebarCategory =
        document.getElementById("sidebarCategory");


    let selectedFiles = [];
    let cropper = null;
    let editingIndex = null;



    /* ==========================================================
       LIVE SIDEBAR PREVIEW
    ========================================================== */

    titleInput?.addEventListener(
        "input",
        () => {

            if (sidebarTitle) {

                sidebarTitle.textContent =
                    titleInput.value.trim() ||
                    "Product title";

            }

        }
    );


    priceInput?.addEventListener(
        "input",
        () => {

            if (!sidebarPrice) {
                return;
            }


            const value =
                Number(
                    priceInput.value
                );


            sidebarPrice.textContent =
                value > 0
                    ? `£${value.toFixed(2)}`
                    : "£0.00";

        }
    );


    categoryInput?.addEventListener(
        "change",
        () => {

            if (!sidebarCategory) {
                return;
            }


            const option =
                categoryInput.options[
                    categoryInput.selectedIndex
                ];


            sidebarCategory.textContent =
                option
                    ? option.text
                    : "Category";

        }
    );



    /* ==========================================================
       DESCRIPTION COUNTER
    ========================================================== */

    function updateDescriptionCounter() {

        if (
            !description ||
            !descriptionCounter
        ) {
            return;
        }


        descriptionCounter.textContent =
            `${description.value.length} / 1000`;

    }


    updateDescriptionCounter();


    description?.addEventListener(
        "input",
        updateDescriptionCounter
    );



    /* ==========================================================
       FILE SELECTION
    ========================================================== */

    imageInput?.addEventListener(
        "change",
        () => {

            const files =
                Array.from(
                    imageInput.files
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
            renderPreviews();

        }
    );



    /* ==========================================================
       RENDER NEW IMAGE PREVIEWS
    ========================================================== */

    function renderPreviews() {

        if (
            !previewGrid ||
            !fileName
        ) {
            return;
        }


        previewGrid.innerHTML =
            "";


        if (
            selectedFiles.length === 0
        ) {

            fileName.textContent =
                "No new photos selected";

            return;

        }


        fileName.textContent =
            selectedFiles.length === 1
                ? "1 new photo selected"
                : `${selectedFiles.length} new photos selected`;


        selectedFiles.forEach(
            (file, index) => {

                const reader =
                    new FileReader();


                reader.onload =
                    event => {

                        const card =
                            document.createElement(
                                "div"
                            );


                        card.className =
                            "preview-card";


                        card.innerHTML = `

                            <img
                                src="${event.target.result}"
                                alt="New selected image"
                            >

                            <div class="preview-actions">

                                <button
                                    type="button"
                                    class="edit-img-btn"
                                    data-index="${index}"
                                >
                                    <i class="fa-solid fa-crop-simple"></i>
                                    Crop
                                </button>

                                <button
                                    type="button"
                                    class="remove-img-btn"
                                    data-index="${index}"
                                >
                                    <i class="fa-regular fa-trash-can"></i>
                                    Remove
                                </button>

                            </div>

                        `;


                        previewGrid.appendChild(
                            card
                        );

                    };


                reader.readAsDataURL(
                    file
                );

            }
        );

    }



    /* ==========================================================
       PREVIEW ACTIONS
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
                renderPreviews();

            }

        }
    );



    /* ==========================================================
       OPEN CROP
    ========================================================== */

    function openCropModal(file) {

        if (
            !file ||
            !cropModal ||
            !cropImage
        ) {
            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            event => {

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
                            movable: true,
                            zoomable: true,
                            rotatable: true,
                            scalable: true,
                            responsive: true,
                            background: false
                        }
                    );

            };


        reader.readAsDataURL(
            file
        );

    }



    /* ==========================================================
       SAVE CROP
    ========================================================== */

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
                    ] =
                        new File(
                            [blob],
                            oldFile.name,
                            {
                                type:
                                    "image/jpeg",

                                lastModified:
                                    Date.now()
                            }
                        );


                    updateFileInput();
                    renderPreviews();
                    closeCropModal();

                },

                "image/jpeg",

                .9
            );

        }
    );



    /* ==========================================================
       CLOSE CROP
    ========================================================== */

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
                event.target ===
                cropModal
            ) {

                closeCropModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                cropModal?.classList.contains(
                    "show"
                )
            ) {

                closeCropModal();

            }

        }
    );


    function closeCropModal() {

        cropModal?.classList.remove(
            "show"
        );


        document.body.classList.remove(
            "crop-open"
        );


        cropper?.destroy();


        cropper = null;
        editingIndex = null;


        if (cropImage) {

            cropImage.src =
                "";

        }

    }



    /* ==========================================================
       UPDATE FILE INPUT
    ========================================================== */

    function updateFileInput() {

        if (!imageInput) {
            return;
        }


        const dataTransfer =
            new DataTransfer();


        selectedFiles.forEach(
            file => {

                dataTransfer.items.add(
                    file
                );

            }
        );


        imageInput.files =
            dataTransfer.files;

    }



    /* ==========================================================
       DRAG AND DROP
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
            renderPreviews();

        }
    );



    /* ==========================================================
       PRICE FORMAT
    ========================================================== */

    priceInput?.addEventListener(
        "blur",
        () => {

            if (
                priceInput.value &&
                !Number.isNaN(
                    Number(
                        priceInput.value
                    )
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
       FORM VALIDATION
    ========================================================== */

    form?.addEventListener(
        "submit",
        event => {

            const title =
                titleInput
                    ?.value
                    .trim();


            const price =
                Number(
                    priceInput?.value
                );


            const category =
                categoryInput
                    ?.value;


            if (!title) {

                event.preventDefault();

                alert(
                    "Please enter a product title."
                );

                return;

            }


            if (
                !price ||
                price <= 0
            ) {

                event.preventDefault();

                alert(
                    "Please enter a valid price."
                );

                return;

            }


            if (!category) {

                event.preventDefault();

                alert(
                    "Please select a category."
                );

                return;

            }


            updateFileInput();

        }
    );

});