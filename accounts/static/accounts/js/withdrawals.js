document.addEventListener("DOMContentLoaded", () => {

    const bankModal = document.getElementById("bankModal");
    const paypalModal = document.getElementById("paypalModal");
    const openBankModal = document.getElementById("openBankModal");
    const openPaypalModal = document.getElementById("openPaypalModal");

    /* ================= OPEN MODALS ================= */

    openBankModal?.addEventListener("click", () => {
        bankModal?.classList.add("show");
    });

    openPaypalModal?.addEventListener("click", () => {
        paypalModal?.classList.add("show");
    });

    /* ================= CLOSE MODALS ================= */

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove("show");

        const form = modal.querySelector("form");
        const msg = modal.querySelector(".withdraw-msg");

        form?.reset();

        if (msg) {
            msg.textContent = "";
            msg.className = "withdraw-msg";
        }
    }

    document.querySelectorAll(".close-modal").forEach(button => {
        button.addEventListener("click", () => {
            const modal = document.getElementById(button.dataset.close);
            closeModal(modal);
        });
    });

    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    /* ================= SUBMIT WITHDRAWAL ================= */

    async function submitWithdrawal(form) {
        const msg = form.querySelector(".withdraw-msg");
        const button = form.querySelector("button[type='submit']");

        if (!msg || !button) return;

        msg.textContent = "";
        msg.className = "withdraw-msg";

        button.disabled = true;
        button.textContent = "Submitting...";

        const formData = new FormData(form);

        try {
            const response = await fetch("/request-withdrawal/", {
                method: "POST",
                body: formData,
                credentials: "include",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = {};

            try {
                data = await response.json();
            } catch {
                data = {
                    success: false,
                    message: "Server returned an invalid response."
                };
            }

            if (!response.ok) {
                msg.textContent = data.message || `Request failed. Error ${response.status}`;
                msg.className = "withdraw-msg error";
                return;
            }

            if (data.success) {
                msg.textContent = data.message || "Withdrawal request submitted successfully.";
                msg.className = "withdraw-msg success";

                setTimeout(() => {
                    const modal = form.closest(".modal-overlay");
                    closeModal(modal);
                }, 1200);

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

    /* ================= FORM EVENTS ================= */

    const bankWithdrawForm = document.getElementById("bankWithdrawForm");
    const paypalWithdrawForm = document.getElementById("paypalWithdrawForm");

    bankWithdrawForm?.addEventListener("submit", event => {
        event.preventDefault();
        submitWithdrawal(bankWithdrawForm);
    });

    paypalWithdrawForm?.addEventListener("submit", event => {
        event.preventDefault();
        submitWithdrawal(paypalWithdrawForm);
    });

    /* ================= CSRF COOKIE ================= */

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