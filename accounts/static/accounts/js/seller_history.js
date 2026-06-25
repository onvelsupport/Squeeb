document.addEventListener("DOMContentLoaded", () => {

    /* ================= SELL AGAIN ================= */

    document.querySelectorAll(".relist-btn").forEach(button => {

        button.addEventListener("click", () => {

            alert(
                "This feature will allow you to relist sold products in one click."
            );

            /*
            Future:

            fetch("/relist-product/", {
                method: "POST"
            })

            */

        });

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