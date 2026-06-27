document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("editProfileForm");
    const msg = document.getElementById("profileMsg");

    async function loadProfile() {
        try {
            const res = await fetch("/api/user-info/", {
                method: "GET",
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
            document.getElementById("phone").value = data.phone_number || "";
            document.getElementById("city").value = data.city || "";

        } catch (err) {
            console.error("Profile load error:", err);
        }
    }

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        msg.textContent = "Saving...";
        msg.style.color = "#2563eb";

        const payload = {
            first_name: document.getElementById("firstName").value.trim(),
            last_name: document.getElementById("lastName").value.trim(),
            username: document.getElementById("username").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone_number: document.getElementById("phone").value.trim(),
            city: document.getElementById("city").value.trim()
        };

        try {
            const res = await fetch("/api/edit-profile/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok || data.success === false) {
                msg.textContent = data.message || data.error || "Profile update failed.";
                msg.style.color = "red";
                return;
            }

            msg.textContent = data.message || "Profile updated successfully.";
            msg.style.color = "green";

        } catch (err) {
            console.error("Profile save error:", err);
            msg.textContent = "Network error. Try again.";
            msg.style.color = "red";
        }
    });

    loadProfile();
});