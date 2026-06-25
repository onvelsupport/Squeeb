document.addEventListener("DOMContentLoaded", () => {
    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            console.log("MORE USER STATUS:", res.status);

            if (res.status === 401 || res.status === 403) {
                console.warn("User is not authenticated.");
                return;
            }

            if (!res.ok) {
                console.error("User info failed:", res.status);
                return;
            }

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", "@" + (data.username || "user"));
            setText("followers", data.followers || 0);
            setText("following", data.following || 0);
            setText("miniName", data.username || "User");
            setText("miniUsername", "@" + (data.username || "user"));

        } catch (err) {
            console.error("MORE PAGE USER LOAD ERROR:", err);
        }
    }

    async function logoutUser(e) {
        if (e) e.preventDefault();

        try {
            await fetch("/api/logout/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });
        } catch (err) {
            console.error("Logout error:", err);
        }

        window.location.href = "/login/";
    }

    document.querySelectorAll(".logout, .logout-item, #logoutBtn, #logoutLink")
        .forEach((btn) => {
            btn.addEventListener("click", logoutUser);
        });

    document.querySelectorAll(".set-item").forEach((item) => {
        item.addEventListener("click", () => {
            item.style.background = "#EEE";
            setTimeout(() => {
                item.style.background = "white";
            }, 150);
        });
    });

    loadUser();
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