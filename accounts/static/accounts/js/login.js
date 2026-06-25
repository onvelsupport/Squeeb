console.log("LOGIN JS LOADED");

document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const loginMessage = document.getElementById("loginMessage");
    const pwToggle = document.getElementById("pwToggle");
    const passwordField = document.getElementById("password");

    function getCSRFToken() {
        const csrfInput = document.querySelector("[name=csrfmiddlewaretoken]");
        return csrfInput ? csrfInput.value : "";
    }

    function showMessage(type, message) {

        if (!loginMessage) return;

        loginMessage.className = "login-message";
        loginMessage.classList.add(type);
        loginMessage.textContent = message;
    }

    if (pwToggle && passwordField) {

        pwToggle.addEventListener("click", () => {

            const icon = pwToggle.querySelector("i");

            if (passwordField.type === "password") {

                passwordField.type = "text";

                if (icon) {
                    icon.classList.remove("fa-eye-slash");
                    icon.classList.add("fa-eye");
                }

            } else {

                passwordField.type = "password";

                if (icon) {
                    icon.classList.remove("fa-eye");
                    icon.classList.add("fa-eye-slash");
                }

            }

        });

    }

    if (!loginForm) {
        console.error("loginForm not found");
        return;
    }

    loginForm.addEventListener("submit", async (e) => {

        console.log("LOGIN FORM SUBMITTED");

        e.preventDefault();

        const username =
            document.getElementById("username")?.value.trim() || "";

        const password =
            document.getElementById("password")?.value.trim() || "";

        if (!username || !password) {

            showMessage(
                "error",
                "Please enter your username and password."
            );

            return;
        }

        showMessage(
            "loading",
            "Logging in..."
        );

        try {

            console.log("ABOUT TO SEND LOGIN REQUEST");

            const response = await fetch("/api/login/", {

                method: "POST",

                credentials: "same-origin",

                headers: {

                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRFToken": getCSRFToken()

                },

                body: JSON.stringify({

                    username: username,
                    password: password

                })

            });

            console.log("Response status:", response.status);

            const data = await response.json();

            console.log("Response data:", data);

            if (response.ok && data.success) {

                showMessage(
                    "success",
                    "Login successful."
                );

                window.location.href =
                    data.redirect_url || "/dashboard/";

            }

            else {

                showMessage(

                    "error",

                    data.message ||
                    data.error ||
                    "Invalid username or password."

                );

            }

        }

        catch (error) {

            console.error("LOGIN ERROR:", error);

            showMessage(
                "error",
                "Something went wrong."
            );

        }

    });

});