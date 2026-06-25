document.addEventListener("DOMContentLoaded", () => {

    const followBtn = document.getElementById("followBtn");
    const followersCount = document.getElementById("followersCount");
    const followingCount = document.getElementById("followingCount");

    function getCSRFToken() {
        return document.querySelector(
            "[name=csrfmiddlewaretoken]"
        )?.value || "";
    }

    if (!followBtn) return;

    followBtn.addEventListener("click", async () => {

        const username = followBtn.dataset.username;

        followBtn.disabled = true;

        try {

            const response = await fetch(
                `/api/follow/${username}/`,
                {
                    method: "POST",
                    credentials: "same-origin",

                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCSRFToken()
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Unable to follow user.");
                return;
            }

            if (data.is_following) {

                followBtn.textContent = "Following";

                followBtn.style.background =
                    "#10b981";

            } else {

                followBtn.textContent = "Follow";

                followBtn.style.background =
                    "#2563eb";

            }

            if (followersCount) {
                followersCount.textContent =
                    data.followers_count;
            }

            if (followingCount) {
                followingCount.textContent =
                    data.following_count;
            }

        }

        catch (error) {

            console.error(
                "FOLLOW ERROR:",
                error
            );

            alert(
                "Something went wrong."
            );

        }

        finally {

            followBtn.disabled = false;

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