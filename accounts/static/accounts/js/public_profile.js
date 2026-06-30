document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // MOBILE MENU
    // ==========================================================

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileDropdown = document.getElementById("mobileDropdown");

    mobileMenuBtn?.addEventListener("click", () => {
        mobileDropdown?.classList.toggle("show");
    });


    // ==========================================================
    // FOLLOW / CONNECT BUTTON
    // ==========================================================

    const followBtn = document.getElementById("followBtn");
    const followersCount = document.getElementById("followersCount");
    const followingCount = document.getElementById("followingCount");

    function getCSRFToken() {
        return document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";
    }

    followBtn?.addEventListener("click", async () => {
        const username = followBtn.dataset.username;

        if (!username) return;

        followBtn.disabled = true;

        try {
            const response = await fetch(`/api/follow/${username}/`, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCSRFToken()
                }
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Unable to connect with user.");
                return;
            }

            if (data.is_following) {
                followBtn.textContent = "Connected";
                followBtn.classList.add("connected");
            } else {
                followBtn.textContent = "Connect";
                followBtn.classList.remove("connected");
            }

            if (followersCount) {
                followersCount.textContent = data.followers_count;
            }

            if (followingCount) {
                followingCount.textContent = data.following_count;
            }

        } catch (error) {
            console.error("FOLLOW ERROR:", error);
            alert("Something went wrong.");
        } finally {
            followBtn.disabled = false;
        }
    });


    // ==========================================================
    // SEARCH BAR
    // ==========================================================

    const searchInput = document.getElementById("globalSearchInput");
    const searchResults = document.getElementById("searchResults");

    searchInput?.addEventListener("input", async () => {
        const query = searchInput.value.trim();

        if (!searchResults) return;

        if (!query) {
            searchResults.style.display = "none";
            searchResults.innerHTML = "";
            return;
        }

        try {
            const res = await fetch(`/api/search/?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            searchResults.innerHTML = "";

            if (!data.results || !data.results.length) {
                searchResults.innerHTML = `
                    <div class="search-item">No results found</div>
                `;
                searchResults.style.display = "block";
                return;
            }

            data.results.forEach(item => {
                searchResults.innerHTML += `
                    <a href="${item.url}" class="search-item">
                        <strong>${item.name}</strong>
                        <div class="search-type">${item.type}</div>
                    </a>
                `;
            });

            searchResults.style.display = "block";

        } catch (err) {
            console.error("SEARCH ERROR:", err);
        }
    });


    // ==========================================================
    // CLOSE SEARCH WHEN CLICKING OUTSIDE
    // ==========================================================

    document.addEventListener("click", (e) => {
        if (
            searchResults &&
            searchInput &&
            !searchInput.contains(e.target) &&
            !searchResults.contains(e.target)
        ) {
            searchResults.style.display = "none";
        }
    });

});