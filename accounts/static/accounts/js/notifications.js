document.addEventListener("DOMContentLoaded", () => {
    const markAllBtn = document.getElementById("markAllBtn");

    if (!markAllBtn) return;

    markAllBtn.addEventListener("click", async () => {
        try {
            const response = await fetch("/notifications/mark-all-read/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCSRFToken(),
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                alert("Could not mark notifications as read.");
                return;
            }

            document.querySelectorAll(".notification-card.unread").forEach(card => {
                card.classList.remove("unread");
            });

        } catch (error) {
            console.error("Notification error:", error);
            alert("Something went wrong.");
        }
    });

    function getCSRFToken() {
        const name = "csrftoken";
        const cookies = document.cookie.split(";");

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith(name + "=")) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }

        return "";
    }
});