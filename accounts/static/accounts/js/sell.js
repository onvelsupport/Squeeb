document.addEventListener("DOMContentLoaded", () => {

    const imageInput = document.getElementById("images");
    const fileName = document.getElementById("fileName");
    const previewGrid = document.getElementById("imagePreviewGrid");

    const cropModal = document.getElementById("cropModal");
    const cropImage = document.getElementById("cropImage");

    const saveCropBtn = document.getElementById("saveCropBtn");
    const cancelCropBtn = document.getElementById("cancelCropBtn");
    const cancelCropIcon = document.getElementById("cancelCropIcon");

    const priceInput = document.getElementById("price");
    const description = document.getElementById("description");

    const form = document.querySelector(".sell-form");
    const uploadBox = document.querySelector(".upload-box");

    let selectedFiles = [];
    let cropper = null;
    let editingIndex = null;


    /* ==========================================================
       IMAGE SELECTION
    ========================================================== */

    imageInput?.addEventListener("change", () => {

        const newFiles =
            Array.from(imageInput.files).filter(file =>
                file.type.startsWith("image/")
            );

        selectedFiles = [
            ...selectedFiles,
            ...newFiles
        ];

        updateFileInput();
        renderImagePreviews();

    });


    /* ==========================================================
       IMAGE PREVIEW
    ========================================================== */

    function renderImagePreviews() {

        if (!previewGrid || !fileName) {
            return;
        }

        previewGrid.innerHTML = "";


        if (selectedFiles.length === 0) {

            fileName.textContent =
                "No photos selected";

            return;

        }


        fileName.textContent =
            selectedFiles.length === 1
                ? selectedFiles[0].name
                : `${selectedFiles.length} photos selected`;


        selectedFiles.forEach((file, index) => {

            const reader =
                new FileReader();


            reader.onload = event => {

                const card =
                    document.createElement("div");


                card.className =
                    "preview-card";


                card.innerHTML = `

                    <div class="preview-image">
                        <img
                            src="${event.target.result}"
                            alt="Selected product image">
                    </div>

                    <div class="preview-actions">

                        <button
                            type="button"
                            class="edit-img-btn"
                            data-index="${index}">
                            <i class="fa-solid fa-crop-simple"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            class="remove-img-btn"
                            data-index="${index}">
                            <i class="fa-regular fa-trash-can"></i>
                            Remove
                        </button>

                    </div>

                `;


                previewGrid.appendChild(card);

            };


            reader.readAsDataURL(file);

        });

    }


    /* ==========================================================
       PREVIEW ACTIONS
    ========================================================== */

    previewGrid?.addEventListener(
        "click",
        event => {

            const editBtn =
                event.target.closest(".edit-img-btn");

            const removeBtn =
                event.target.closest(".remove-img-btn");


            if (editBtn) {

                editingIndex =
                    Number(editBtn.dataset.index);

                openCropModal(
                    selectedFiles[editingIndex]
                );

            }


            if (removeBtn) {

                const index =
                    Number(removeBtn.dataset.index);


                selectedFiles.splice(
                    index,
                    1
                );


                updateFileInput();
                renderImagePreviews();

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


        reader.onload = event => {

            cropImage.src =
                event.target.result;


            cropModal.classList.add("show");

            document.body.classList.add(
                "crop-open"
            );


            if (cropper) {
                cropper.destroy();
            }


            cropper =
                new Cropper(
                    cropImage,
                    {
                        aspectRatio: NaN,
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


        reader.readAsDataURL(file);

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


                    const editedFile =
                        new File(
                            [blob],
                            oldFile.name,
                            {
                                type: "image/jpeg",
                                lastModified:
                                    Date.now()
                            }
                        );


                    selectedFiles[
                        editingIndex
                    ] = editedFile;


                    updateFileInput();
                    renderImagePreviews();

                    closeCropModal();

                },
                "image/jpeg",
                0.9
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
                cropModal?.classList.contains("show")
            ) {
                closeCropModal();
            }

        }
    );


    function closeCropModal() {

        cropModal?.classList.remove("show");

        document.body.classList.remove(
            "crop-open"
        );


        if (cropper) {

            cropper.destroy();
            cropper = null;

        }


        if (cropImage) {
            cropImage.src = "";
        }


        editingIndex = null;

    }


    /* ==========================================================
       UPDATE REAL FILE INPUT
    ========================================================== */

    function updateFileInput() {

        if (!imageInput) {
            return;
        }


        const dataTransfer =
            new DataTransfer();


        selectedFiles.forEach(file => {

            dataTransfer.items.add(file);

        });


        imageInput.files =
            dataTransfer.files;

    }


    /* ==========================================================
       PRICE FORMAT
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
       DESCRIPTION COUNTER
    ========================================================== */

    if (description) {

        const counter =
            document.createElement("small");


        counter.className =
            "description-counter";


        description.parentNode.appendChild(
            counter
        );


        function updateCounter() {

            counter.textContent =
                `${description.value.length}/1000`;

        }


        updateCounter();


        description.addEventListener(
            "input",
            updateCounter
        );

    }


    /* ==========================================================
       FORM VALIDATION
    ========================================================== */

    form?.addEventListener(
        "submit",
        event => {

            const title =
                document
                    .getElementById("title")
                    ?.value
                    .trim();


            const price =
                Number(
                    document
                        .getElementById("price")
                        ?.value
                );


            const category =
                document
                    .getElementById("category")
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


    /* ==========================================================
       DRAG AND DROP
    ========================================================== */

    uploadBox?.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            uploadBox.classList.add(
                "dragging"
            );

        }
    );


    uploadBox?.addEventListener(
        "dragleave",
        () => {

            uploadBox.classList.remove(
                "dragging"
            );

        }
    );


    uploadBox?.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            uploadBox.classList.remove(
                "dragging"
            );


            const droppedFiles =
                Array
                    .from(
                        event
                            .dataTransfer
                            .files
                    )
                    .filter(file =>
                        file.type.startsWith(
                            "image/"
                        )
                    );


            selectedFiles = [
                ...selectedFiles,
                ...droppedFiles
            ];


            updateFileInput();
            renderImagePreviews();

        }
    );

});