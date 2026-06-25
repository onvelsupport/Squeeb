document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("images");
    const fileName = document.getElementById("fileName");
    const previewGrid = document.getElementById("imagePreviewGrid");

    const cropModal = document.getElementById("cropModal");
    const cropImage = document.getElementById("cropImage");
    const saveCropBtn = document.getElementById("saveCropBtn");
    const cancelCropBtn = document.getElementById("cancelCropBtn");

    const priceInput = document.getElementById("price");
    const description = document.getElementById("description");
    const form = document.querySelector(".edit-form");

    let selectedFiles = [];
    let cropper = null;
    let editingIndex = null;

    imageInput?.addEventListener("change", () => {
        const newFiles = Array.from(imageInput.files);

        selectedFiles = [...selectedFiles, ...newFiles];

        updateFileInput();
        renderPreviews();
    });

    function renderPreviews() {
        previewGrid.innerHTML = "";

        if (selectedFiles.length === 0) {
            fileName.textContent = "No new photos selected";
            return;
        }

        fileName.textContent =
            selectedFiles.length === 1
                ? selectedFiles[0].name
                : `${selectedFiles.length} new photos selected`;

        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const card = document.createElement("div");
                card.className = "preview-card";

                card.innerHTML = `
                    <img src="${e.target.result}" alt="New selected image">

                    <div class="preview-actions">
                        <button type="button" class="edit-img-btn" data-index="${index}">
                            Crop
                        </button>

                        <button type="button" class="remove-img-btn" data-index="${index}">
                            Remove
                        </button>
                    </div>
                `;

                previewGrid.appendChild(card);
            };

            reader.readAsDataURL(file);
        });
    }

    previewGrid?.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-img-btn");
        const removeBtn = e.target.closest(".remove-img-btn");

        if (editBtn) {
            editingIndex = Number(editBtn.dataset.index);
            openCropModal(selectedFiles[editingIndex]);
        }

        if (removeBtn) {
            const index = Number(removeBtn.dataset.index);

            selectedFiles.splice(index, 1);

            updateFileInput();
            renderPreviews();
        }
    });

    function openCropModal(file) {
        if (!file || !cropModal || !cropImage) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            cropImage.src = e.target.result;
            cropModal.classList.add("show");

            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(cropImage, {
                aspectRatio: NaN,
                viewMode: 1,
                autoCropArea: 1,
                movable: true,
                zoomable: true,
                rotatable: true,
                scalable: true,
                responsive: true,
                background: false
            });
        };

        reader.readAsDataURL(file);
    }

    saveCropBtn?.addEventListener("click", () => {
        if (!cropper || editingIndex === null) return;

        cropper.getCroppedCanvas({
            width: 1000,
            height: 1000,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"
        }).toBlob((blob) => {
            if (!blob) return;

            const oldFile = selectedFiles[editingIndex];

            const editedFile = new File(
                [blob],
                oldFile.name,
                {
                    type: "image/jpeg",
                    lastModified: Date.now()
                }
            );

            selectedFiles[editingIndex] = editedFile;

            updateFileInput();
            renderPreviews();
            closeCropModal();

        }, "image/jpeg", 0.9);
    });

    cancelCropBtn?.addEventListener("click", closeCropModal);

    cropModal?.addEventListener("click", (e) => {
        if (e.target === cropModal) {
            closeCropModal();
        }
    });

    function closeCropModal() {
        cropModal?.classList.remove("show");

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        if (cropImage) {
            cropImage.src = "";
        }

        editingIndex = null;
    }

    function updateFileInput() {
        const dataTransfer = new DataTransfer();

        selectedFiles.forEach(file => {
            dataTransfer.items.add(file);
        });

        imageInput.files = dataTransfer.files;
    }

    priceInput?.addEventListener("blur", () => {
        if (priceInput.value && !isNaN(priceInput.value)) {
            priceInput.value = parseFloat(priceInput.value).toFixed(2);
        }
    });

    if (description) {
        const counter = document.createElement("small");

        counter.style.color = "#64748b";
        counter.style.marginTop = "5px";

        description.parentNode.appendChild(counter);

        function updateCounter() {
            counter.textContent = `${description.value.length}/1000 characters`;
        }

        updateCounter();

        description.addEventListener("input", updateCounter);
    }

    form?.addEventListener("submit", (e) => {
        const title = document.getElementById("title")?.value.trim();
        const price = parseFloat(document.getElementById("price")?.value);
        const category = document.getElementById("category")?.value;

        if (!title) {
            e.preventDefault();
            alert("Please enter a product title.");
            return;
        }

        if (!price || price <= 0) {
            e.preventDefault();
            alert("Please enter a valid price.");
            return;
        }

        if (!category) {
            e.preventDefault();
            alert("Please select a category.");
            return;
        }

        updateFileInput();
    });
});