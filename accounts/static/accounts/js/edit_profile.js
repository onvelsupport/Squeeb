document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("editProfileForm");
    const msg = document.getElementById("profileMsg");

    async function loadProfile() {
        try {
            const res = await fetch("/api/user-info/", {
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) return;

            const data = await res.json();

            document.getElementById("firstName").value = data.first_name || "";
            document.getElementById("lastName").value = data.last_name || "";
            document.getElementById("username").value = data.username || "";
            document.getElementById("email").value = data.email || "";
            document.getElementById("phone").value = data.phone || "";
            document.getElementById("city").value = data.city || "";

        } catch (err) {
            console.error("Profile load error:", err);
        }
    }

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        msg.textContent = "Saving...";

        const payload = {
            first_name: document.getElementById("firstName").value.trim(),
            last_name: document.getElementById("lastName").value.trim(),
            username: document.getElementById("username").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            city: document.getElementById("city").value.trim()
        };

        try {
            const res = await fetch("/api/edit-profile/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                msg.textContent = data.error || "Profile update failed.";
                return;
            }

            msg.textContent = data.message || "Profile updated successfully.";

        } catch (err) {
            console.error("Profile save error:", err);
            msg.textContent = "Network error. Try again.";
        }
    });

    loadProfile();
});