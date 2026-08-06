document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("updatePasswordForm");
    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const updateButton = document.getElementById("updatePasswordBtn");
    const messageBox = document.getElementById("passwordMessage");

    const strengthBar = document.getElementById("strengthBar");
    const strengthText = document.getElementById("strengthText");

    const rules = {
        length: document.getElementById("ruleLength"),
        upper: document.getElementById("ruleUpper"),
        lower: document.getElementById("ruleLower"),
        number: document.getElementById("ruleNumber"),
        match: document.getElementById("ruleMatch"),
    };

    function getCookie(name) {
        const cookies = document.cookie
            ? document.cookie.split(";")
            : [];

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith(`${name}=`)) {
                return decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
            }
        }

        return "";
    }

    function showMessage(message, type = "error") {
        if (!messageBox) {
            return;
        }

        messageBox.hidden = false;
        messageBox.className = `password-message ${type}`;
        messageBox.textContent = message;
    }

    function clearMessage() {
        if (!messageBox) {
            return;
        }

        messageBox.hidden = true;
        messageBox.textContent = "";
        messageBox.className = "password-message";
    }

    function setRule(element, valid) {
        if (!element) {
            return;
        }

        element.classList.toggle("valid", valid);
    }

    function evaluatePassword() {
        const password = newPassword?.value || "";
        const confirmation = confirmPassword?.value || "";

        const checks = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password),
            match:
                password.length > 0 &&
                confirmation.length > 0 &&
                password === confirmation,
        };

        setRule(rules.length, checks.length);
        setRule(rules.upper, checks.upper);
        setRule(rules.lower, checks.lower);
        setRule(rules.number, checks.number);
        setRule(rules.match, checks.match);

        const score = [
            checks.length,
            checks.upper,
            checks.lower,
            checks.number,
        ].filter(Boolean).length;

        if (strengthBar) {
            strengthBar.style.width = `${score * 25}%`;

            if (score <= 1) {
                strengthBar.style.background = "#dc2626";
            } else if (score <= 3) {
                strengthBar.style.background = "#d97706";
            } else {
                strengthBar.style.background = "#15803d";
            }
        }

        if (strengthText) {
            if (!password) {
                strengthText.textContent = "Password strength";
            } else if (score <= 1) {
                strengthText.textContent = "Weak password";
            } else if (score <= 3) {
                strengthText.textContent = "Medium password";
            } else {
                strengthText.textContent = "Strong password";
            }
        }

        return checks;
    }

    async function parseJson(response) {
        const type = response.headers.get("content-type") || "";

        if (!type.includes("application/json")) {
            return {};
        }

        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    document.querySelectorAll(".password-toggle").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.target;
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            const showing = input.type === "text";

            input.type = showing ? "password" : "text";

            button.innerHTML = showing
                ? '<i class="fa-regular fa-eye"></i>'
                : '<i class="fa-regular fa-eye-slash"></i>';

            button.setAttribute(
                "aria-label",
                showing ? "Show password" : "Hide password"
            );
        });
    });

    newPassword?.addEventListener("input", evaluatePassword);
    confirmPassword?.addEventListener("input", evaluatePassword);

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();

        const current = currentPassword?.value || "";
        const next = newPassword?.value || "";
        const confirm = confirmPassword?.value || "";

        if (!current || !next || !confirm) {
            showMessage("Please complete all password fields.");
            return;
        }

        const checks = evaluatePassword();

        if (
            !checks.length ||
            !checks.upper ||
            !checks.lower ||
            !checks.number
        ) {
            showMessage(
                "Your new password does not meet the password requirements."
            );
            return;
        }

        if (!checks.match) {
            showMessage("Your new passwords do not match.");
            return;
        }

        if (current === next) {
            showMessage(
                "Your new password must be different from your current password."
            );
            return;
        }

        const originalButton = updateButton?.innerHTML;

        if (updateButton) {
            updateButton.disabled = true;
            updateButton.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Updating Password...</span>
            `;
        }

        try {
            const response = await fetch(
                "/api/update-password/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    body: JSON.stringify({
                        current_password: current,
                        new_password: next,
                        confirm_password: confirm,
                    }),
                }
            );

            const data = await parseJson(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Could not update your password."
                );
            }

            showMessage(
                data.message ||
                "Your password has been updated successfully.",
                "success"
            );

            form.reset();
            evaluatePassword();

        } catch (error) {
            console.error(
                "UPDATE PASSWORD ERROR:",
                error
            );

            showMessage(
                error.message ||
                "Could not update your password."
            );

        } finally {
            if (updateButton) {
                updateButton.disabled = false;
                updateButton.innerHTML = originalButton;
            }
        }
    });

});
