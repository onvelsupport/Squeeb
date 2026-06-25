document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       MOBILE MENU
    ========================================================== */

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileDropdown = document.getElementById("mobileDropdown");

    mobileMenuBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileDropdown?.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (
            mobileDropdown &&
            mobileMenuBtn &&
            !mobileDropdown.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)
        ) {
            mobileDropdown.classList.remove("show");
        }
    });

    /* ==========================================================
       PRODUCT IMAGE GALLERY
    ========================================================== */

    const mainImage = document.getElementById("mainProductImage");
    const thumbnails = document.querySelectorAll(".thumbnail-btn");

    thumbnails.forEach(button => {
        button.addEventListener("click", () => {
            const img = button.querySelector("img");

            if (!img || !mainImage) return;

            mainImage.src = img.src;

            thumbnails.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
        });
    });

    /* ==========================================================
       RELATED PRODUCT CARD CLICK
    ========================================================== */

    document.querySelectorAll(".clickable-product").forEach(card => {
        card.addEventListener("click", () => {
            const url = card.dataset.url;

            if (url) {
                window.location.href = url;
            }
        });
    });

    /* ==========================================================
       DELETE PRODUCT CONFIRMATION
    ========================================================== */

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

    /* ==========================================================
       LOGOUT
    ========================================================== */

    async function logout(e) {
        e.preventDefault();

        try {
            await fetch("/api/logout/", {
                method: "POST",
                credentials: "same-origin"
            });
        }

        catch (err) {
            console.error("Logout error:", err);
        }

        window.location.href = "/login/";
    }

    document.querySelectorAll(".logout").forEach(btn => {
        btn.addEventListener("click", logout);
    });

    /* ==========================================================
       GLOBAL SEARCH BAR
    ========================================================== */

    const searchInput = document.getElementById("globalSearchInput");
    const searchResults = document.getElementById("searchResults");

    searchInput?.addEventListener("input", async () => {
        const query = searchInput.value.trim();

        if (!query) {
            searchResults.style.display = "none";
            searchResults.innerHTML = "";
            return;
        }

        try {
            const res = await fetch(
                `/api/search/?q=${encodeURIComponent(query)}`
            );

            const data = await res.json();

            searchResults.innerHTML = "";

            if (!data.results || !data.results.length) {
                searchResults.innerHTML =
                    `<div class="search-item">No results found</div>`;

                searchResults.style.display = "block";
                return;
            }

            data.results.forEach(item => {
                searchResults.innerHTML += `
                    <a href="${item.url}" class="search-item">
                        <strong>${item.name}</strong>

                        <div class="search-type">
                            ${item.type}
                        </div>
                    </a>
                `;
            });

            searchResults.style.display = "block";
        }

        catch (err) {
            console.error("Search error:", err);
        }
    });

    /* ==========================================================
       CLOSE SEARCH RESULTS WHEN CLICKING OUTSIDE
    ========================================================== */

    document.addEventListener("click", (e) => {
        if (
            searchResults &&
            searchInput &&
            !searchResults.contains(e.target) &&
            !searchInput.contains(e.target)
        ) {
            searchResults.style.display = "none";
        }
    });

});



/* ==========================================================
   MESSAGE SELLER MODAL
========================================================== */

const openMessageModal = document.getElementById("openMessageModal");
const closeMessageModal = document.getElementById("closeMessageModal");
const messageModal = document.getElementById("messageModal");

openMessageModal?.addEventListener("click", () => {
    messageModal?.classList.add("show");
});

closeMessageModal?.addEventListener("click", () => {
    messageModal?.classList.remove("show");
});

messageModal?.addEventListener("click", (e) => {
    if (e.target === messageModal) {
        messageModal.classList.remove("show");
    }
});