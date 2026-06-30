document.addEventListener("DOMContentLoaded", () => {

    const followBtn = document.getElementById("followBtn");
    const followersCount = document.getElementById("followersCount");

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

            followBtn.textContent = data.is_following ? "Connected" : "Connect";
            followBtn.classList.toggle("connected", data.is_following);

            if (followersCount) {
                followersCount.textContent = data.followers_count;
            }

        } catch (error) {
            console.error("FOLLOW ERROR:", error);
            alert("Something went wrong.");
        } finally {
            followBtn.disabled = false;
        }
    });

});