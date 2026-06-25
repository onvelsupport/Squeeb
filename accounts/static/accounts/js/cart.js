document.addEventListener("DOMContentLoaded", () => {

    /* ================= REMOVE ITEM CONFIRMATION ================= */

    document.querySelectorAll(".remove-btn").forEach(button => {

        button.addEventListener("click", function (e) {

            const confirmed = confirm(
                "Remove this item from your cart?"
            );

            if (!confirmed) {
                e.preventDefault();
            }

        });

    });

/* ================= CHECKOUT BUTTON ================= */

const checkoutBtn = document.querySelector(".checkout-btn");

checkoutBtn?.addEventListener("click", async () => {
    try {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Redirecting...";

        const res = await fetch("/cart/create-checkout/", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Checkout failed.");
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = "Proceed to Checkout";
            return;
        }

        window.location.href = data.checkout_url;

    } catch (error) {
        console.error(error);
        alert("Network error. Please try again.");

        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Proceed to Checkout";
    }
});

});

    // ==========================================================
    // SEARCH BAR
    // ==========================================================
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

        if (!data.results.length) {

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

    catch(err) {

        console.error(err);

    }

});