document.addEventListener("DOMContentLoaded", () => {
    const bankModal = document.getElementById("bankModal");
    const paypalModal = document.getElementById("paypalModal");

    document.getElementById("openBankModal")?.addEventListener("click", () => {
        bankModal.classList.add("show");
    });

    document.getElementById("openPaypalModal")?.addEventListener("click", () => {
        paypalModal.classList.add("show");
    });

    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById(btn.dataset.close).classList.remove("show");
        });
    });

    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal) {
                modal.classList.remove("show");
            }
        });
    });

    async function submitWithdrawal(form) {
        const msg = form.querySelector(".withdraw-msg");
        const button = form.querySelector("button[type='submit']");

        msg.textContent = "";
        button.disabled = true;
        button.textContent = "Submitting...";

        const formData = new FormData(form);

        try {
            const response = await fetch("/request-withdrawal/", {
                method: "POST",
                body: formData,
                headers: {
                    "X-CSRFToken": getCookie("csrftoken")
                }
            });

            const data = await response.json();

            if (data.success) {
                msg.textContent = "Withdrawal request submitted successfully.";
                msg.className = "withdraw-msg success";
                form.reset();
            } else {
                msg.textContent = data.message || "Something went wrong.";
                msg.className = "withdraw-msg error";
            }

        } catch (error) {
            msg.textContent = "Network error. Please try again.";
            msg.className = "withdraw-msg error";
        } finally {
            button.disabled = false;
            button.textContent = "Submit Withdrawal";
        }
    }

    document.getElementById("bankWithdrawForm")?.addEventListener("submit", e => {
        e.preventDefault();
        submitWithdrawal(e.target);
    });

    document.getElementById("paypalWithdrawForm")?.addEventListener("submit", e => {
        e.preventDefault();
        submitWithdrawal(e.target);
    });

    function getCookie(name) {
        let cookieValue = null;

        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");

            for (let cookie of cookies) {
                cookie = cookie.trim();

                if (cookie.startsWith(name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }

        return cookieValue;
    }
});