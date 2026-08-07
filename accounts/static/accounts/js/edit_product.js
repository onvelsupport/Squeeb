document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const form =
        document.getElementById("editProductForm");


    const imageInput =
        document.getElementById("images");

    const fileName =
        document.getElementById("fileName");

    const previewGrid =
        document.getElementById("imagePreviewGrid");

    const uploadZone =
        document.querySelector(".upload-zone");


    const removeImageIdsInput =
        document.getElementById("removeImageIds");

    const removeMainImageInput =
        document.getElementById("removeMainImage");


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


    const sidebarTitle =
        document.getElementById("sidebarTitle");

    const sidebarPrice =
        document.getElementById("sidebarPrice");

    const sidebarCategory =
        document.getElementById("sidebarCategory");


    /* ==========================================================
       STATE
    ========================================================== */

    let selectedFiles = [];

    let cropper = null;

    let cropMode = null;

    let cropNewIndex = null;

    let cropExistingId = null;

    let cropExistingCard = null;

    let removedExistingIds =
        new Set();



    /* ==========================================================
       LIVE TEXT PREVIEW
    ========================================================== */

    titleInput?.addEventListener(
        "input",
        () => {

            if (!sidebarTitle) {
                return;
            }

            sidebarTitle.textContent =
                titleInput.value.trim()
                || "Product title";

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
       EXISTING PHOTO REMOVE
    ========================================================== */

    document
        .querySelectorAll(
            ".remove-existing-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const imageId =
                        button.dataset.imageId;


                    if (!imageId) {
                        return;
                    }


                    removedExistingIds.add(
                        String(imageId)
                    );


                    syncRemovedImageIds();


                    const card =
                        button.closest(
                            ".current-image-card"
                        );


                    card?.classList.add(
                        "pending-removal"
                    );

                }
            );

        });


    document
        .querySelectorAll(
            ".undo-remove-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const imageId =
                        button.dataset.imageId;


                    removedExistingIds.delete(
                        String(imageId)
                    );


                    syncRemovedImageIds();


                    const card =
                        button.closest(
                            ".current-image-card"
                        );


                    card?.classList.remove(
                        "pending-removal"
                    );

                }
            );

        });


    function syncRemovedImageIds() {

        if (!removeImageIdsInput) {
            return;
        }


        removeImageIdsInput.value =
            Array
                .from(
                    removedExistingIds
                )
                .join(",");

    }



    /* ==========================================================
       LEGACY MAIN IMAGE REMOVE
    ========================================================== */

    document
        .querySelectorAll(
            ".remove-main-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    if (
                        removeMainImageInput
                    ) {

                        removeMainImageInput.value =
                            "1";

                    }


                    button
                        .closest(
                            ".current-image-card"
                        )
                        ?.classList.add(
                            "pending-removal"
                        );

                }
            );

        });


    document
        .querySelectorAll(
            ".undo-main-remove-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    if (
                        removeMainImageInput
                    ) {

                        removeMainImageInput.value =
                            "0";

                    }


                    button
                        .closest(
                            ".current-image-card"
                        )
                        ?.classList.remove(
                            "pending-removal"
                        );

                }
            );

        });



    /* ==========================================================
       CROP EXISTING PRODUCTIMAGE
    ========================================================== */

    document
        .querySelectorAll(
            ".crop-existing-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const imageId =
                        button.dataset.imageId;

                    const imageUrl =
                        button.dataset.imageUrl;


                    if (
                        !imageId ||
                        !imageUrl
                    ) {
                        return;
                    }


                    cropMode =
                        "existing";


                    cropExistingId =
                        String(imageId);


                    cropExistingCard =
                        button.closest(
                            ".current-image-card"
                        );


                    openCropFromUrl(
                        imageUrl
                    );

                }
            );

        });



    /* ==========================================================
       CROP LEGACY MAIN IMAGE
    ========================================================== */

    document
        .querySelectorAll(
            ".crop-main-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const imageUrl =
                        button.dataset.imageUrl;


                    if (!imageUrl) {
                        return;
                    }


                    cropMode =
                        "main";


                    cropExistingCard =
                        button.closest(
                            ".current-image-card"
                        );


                    openCropFromUrl(
                        imageUrl
                    );

                }
            );

        });



    /* ==========================================================
       OPEN EXISTING IMAGE IN CROPPER
    ========================================================== */

    function openCropFromUrl(url) {

        if (
            !cropModal ||
            !cropImage
        ) {
            return;
        }


        destroyCropper();


        cropModal.classList.add(
            "show"
        );


        document.body.classList.add(
            "crop-open"
        );


        cropImage.crossOrigin =
            "anonymous";


        cropImage.src =
            url;


        cropImage.onload =
            () => {

                createCropper();

            };


        cropImage.onerror =
            () => {

                closeCropModal();

                alert(
                    "Unable to load this image for editing."
                );

            };

    }



    /* ==========================================================
       NEW PHOTO SELECTION
    ========================================================== */

    imageInput?.addEventListener(
        "change",
        () => {

            const files =
                Array
                    .from(
                        imageInput.files
                    )
                    .filter(file =>
                        file.type.startsWith(
                            "image/"
                        )
                    );


            selectedFiles = [
                ...selectedFiles,
                ...files
            ];


            updateNewFileInput();

            renderNewPreviews();

        }
    );



    /* ==========================================================
       RENDER NEW IMAGE PREVIEWS
    ========================================================== */

    function renderNewPreviews() {

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
                                alt="New selected product image"
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
       NEW IMAGE ACTIONS
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

                const index =
                    Number(
                        editButton.dataset.index
                    );


                const file =
                    selectedFiles[index];


                if (!file) {
                    return;
                }


                cropMode =
                    "new";


                cropNewIndex =
                    index;


                openCropFromFile(
                    file
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


                updateNewFileInput();

                renderNewPreviews();

            }

        }
    );



    /* ==========================================================
       OPEN NEW FILE IN CROPPER
    ========================================================== */

    function openCropFromFile(file) {

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

                destroyCropper();


                cropImage.removeAttribute(
                    "crossorigin"
                );


                cropImage.src =
                    event.target.result;


                cropModal.classList.add(
                    "show"
                );


                document.body.classList.add(
                    "crop-open"
                );


                cropImage.onload =
                    () => {

                        createCropper();

                    };

            };


        reader.readAsDataURL(
            file
        );

    }



    /* ==========================================================
       CREATE CROPPER
    ========================================================== */

    function createCropper() {

        destroyCropper();


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

    }



    /* ==========================================================
       SAVE CROP
    ========================================================== */

    saveCropBtn?.addEventListener(
        "click",
        () => {

            if (!cropper) {
                return;
            }


            const canvas =
                cropper.getCroppedCanvas({
                    maxWidth: 1600,
                    maxHeight: 1600,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: "high"
                });


            if (!canvas) {

                alert(
                    "Unable to crop this image."
                );

                return;
            }


            canvas.toBlob(
                blob => {

                    if (!blob) {

                        alert(
                            "Unable to save this crop."
                        );

                        return;
                    }


                    const file =
                        new File(
                            [blob],
                            `squeeb-crop-${Date.now()}.jpg`,
                            {
                                type:
                                    "image/jpeg",

                                lastModified:
                                    Date.now()
                            }
                        );


                    /* ----------------------------------------------
                       NEW IMAGE
                    ---------------------------------------------- */

                    if (
                        cropMode === "new" &&
                        cropNewIndex !== null
                    ) {

                        selectedFiles[
                            cropNewIndex
                        ] = file;


                        updateNewFileInput();

                        renderNewPreviews();

                    }


                    /* ----------------------------------------------
                       EXISTING PRODUCTIMAGE
                    ---------------------------------------------- */

                    if (
                        cropMode === "existing" &&
                        cropExistingId
                    ) {

                        createExistingCropInput(
                            cropExistingId,
                            file
                        );


                        updateCurrentCardPreview(
                            cropExistingCard,
                            blob
                        );

                    }


                    /* ----------------------------------------------
                       LEGACY MAIN IMAGE
                    ---------------------------------------------- */

                    if (
                        cropMode === "main"
                    ) {

                        createMainCropInput(
                            file
                        );


                        updateCurrentCardPreview(
                            cropExistingCard,
                            blob
                        );

                    }


                    closeCropModal();

                },

                "image/jpeg",

                0.92
            );

        }
    );



    /* ==========================================================
       EXISTING CROP FILE INPUT
    ========================================================== */

    function createExistingCropInput(
        imageId,
        file
    ) {

        const inputId =
            `crop-existing-input-${imageId}`;


        let input =
            document.getElementById(
                inputId
            );


        if (!input) {

            input =
                document.createElement(
                    "input"
                );


            input.type =
                "file";


            input.hidden =
                true;


            input.id =
                inputId;


            input.name =
                `crop_existing_${imageId}`;


            form.appendChild(
                input
            );

        }


        const transfer =
            new DataTransfer();


        transfer.items.add(
            file
        );


        input.files =
            transfer.files;

    }



    /* ==========================================================
       LEGACY MAIN CROP INPUT
    ========================================================== */

    function createMainCropInput(file) {

        let input =
            document.getElementById(
                "cropMainImageInput"
            );


        if (!input) {

            input =
                document.createElement(
                    "input"
                );


            input.type =
                "file";


            input.hidden =
                true;


            input.id =
                "cropMainImageInput";


            input.name =
                "crop_main_image";


            form.appendChild(
                input
            );

        }


        const transfer =
            new DataTransfer();


        transfer.items.add(
            file
        );


        input.files =
            transfer.files;

    }



    /* ==========================================================
       UPDATE CURRENT IMAGE PREVIEW
    ========================================================== */

    function updateCurrentCardPreview(
        card,
        blob
    ) {

        if (!card) {
            return;
        }


        const image =
            card.querySelector("img");


        if (!image) {
            return;
        }


        image.removeAttribute(
            "crossorigin"
        );


        image.src =
            URL.createObjectURL(
                blob
            );


        card.classList.add(
            "has-crop"
        );

    }



    /* ==========================================================
       CLOSE CROPPER
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


    function destroyCropper() {

        if (cropper) {

            cropper.destroy();

            cropper =
                null;

        }

    }


    function closeCropModal() {

        cropModal?.classList.remove(
            "show"
        );


        document.body.classList.remove(
            "crop-open"
        );


        destroyCropper();


        if (cropImage) {

            cropImage.onload =
                null;

            cropImage.onerror =
                null;

            cropImage.src =
                "";

        }


        cropMode =
            null;

        cropNewIndex =
            null;

        cropExistingId =
            null;

        cropExistingCard =
            null;

    }



    /* ==========================================================
       UPDATE NEW FILE INPUT
    ========================================================== */

    function updateNewFileInput() {

        if (!imageInput) {
            return;
        }


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
                Array
                    .from(
                        event.dataTransfer.files
                    )
                    .filter(file =>
                        file.type.startsWith(
                            "image/"
                        )
                    );


            selectedFiles = [
                ...selectedFiles,
                ...files
            ];


            updateNewFileInput();

            renderNewPreviews();

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
       VALIDATE FORM
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


            syncRemovedImageIds();

            updateNewFileInput();

        }
    );

});