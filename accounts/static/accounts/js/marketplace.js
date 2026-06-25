document.addEventListener("DOMContentLoaded", () => {

    /* ================= MOBILE MENU ================= */

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileDropdown = document.getElementById("mobileDropdown");

    if (mobileMenuBtn && mobileDropdown) {

        mobileMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileDropdown.classList.toggle("show");
        });

        document.addEventListener("click", (e) => {

            if (
                !mobileDropdown.contains(e.target) &&
                !mobileMenuBtn.contains(e.target)
            ) {
                mobileDropdown.classList.remove("show");
            }

        });

    }

    /* ================= LOGOUT ================= */

    async function logout(e) {

        e.preventDefault();

        try {

            await fetch("/api/logout/", {
                method: "POST",
                credentials: "same-origin"
            });

        } catch (err) {

            console.error("Logout error:", err);

        }

        window.location.href = "/login/";

    }

    document.querySelectorAll(".logout").forEach(btn => {
        btn.addEventListener("click", logout);
    });


    /* ================= EDIT PRODUCT MODAL ================= */

    const editModal = document.getElementById("editModal");
    const closeEditModal = document.getElementById("closeEditModal");
    const editForm = document.getElementById("editForm");

    document.querySelectorAll(".edit-btn").forEach(button => {

        button.addEventListener("click", function () {

            if (!editModal) return;

            document.getElementById("editId").value =
                this.dataset.id;

            document.getElementById("editTitle").value =
                this.dataset.title;

            document.getElementById("editPrice").value =
                this.dataset.price;

            document.getElementById("editCategory").value =
                this.dataset.category;

            document.getElementById("editDescription").value =
                this.dataset.description;

            document.getElementById("editSold").checked =
                this.dataset.sold === "1";

            editForm.action = `/edit-product/${this.dataset.id}/`;

            editModal.style.display = "flex";

        });

    });

    closeEditModal?.addEventListener("click", () => {

        editModal.style.display = "none";

    });

    /* ================= DELETE PRODUCT ================= */

    document.querySelectorAll(".delete-product").forEach(button => {

        button.addEventListener("click", (e) => {

            const confirmed = confirm(
                "Are you sure you want to delete this product?"
            );

            if (!confirmed) {
                e.preventDefault();
            }

        });

    });

    /* ================= WINDOW CLICK ================= */

    window.addEventListener("click", (e) => {

        if (e.target === sellModal) {

            sellModal.style.display = "none";

        }

        if (e.target === editModal) {

            editModal.style.display = "none";

        }

    });

});