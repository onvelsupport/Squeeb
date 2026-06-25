document.addEventListener("DOMContentLoaded", () => {

    async function logout() {
        await fetch("/api/logout/", {
            method: "POST",
            credentials: "include"
        });
        window.location.href = "/login/";
    }

    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("logoutBtn2")?.addEventListener("click", logout);

});
