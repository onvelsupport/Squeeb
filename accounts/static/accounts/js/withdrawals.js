document.addEventListener("DOMContentLoaded", () => {
    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    const bankModal = document.getElementById("bankModal");
    const paypalModal = document.getElementById("paypalModal");
    const openBankModal = document.getElementById("openBankModal");
    const openPaypalModal = document.getElementById("openPaypalModal");

    const withdrawHistoryList = document.getElementById("withdrawHistoryList");
    const withdrawTabs = document.querySelectorAll(".withdraw-tab");

    let allWithdrawals = [];
    let activeFilter = "all";

    openBankModal?.addEventListener("click", () => {
        bankModal?.classList.add("show");
    });

    openPaypalModal?.addEventListener("click", () => {
        paypalModal?.classList.add("show");
    });

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
            if (event.target === modal) closeModal(modal);
        });
    });

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) return;

            const data = await res.json();

            const usernameDisplay = document.getElementById("usernameDisplay");
            const balanceAmount = document.getElementById("balanceAmount");

            if (usernameDisplay) usernameDisplay.textContent = data.username || "User";
            if (balanceAmount) balanceAmount.textContent = money(data.balance);

        } catch (error) {
            console.error("User load error:", error);
        }
    }

    async function loadWithdrawals() {
        if (!withdrawHistoryList) return;

        try {
            const res = await fetch("/api/withdrawal-history/", {
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) {
                withdrawHistoryList.innerHTML = `
                    <div class="empty-withdraw">
                        <i class="fa fa-triangle-exclamation"></i>
                        <h3>Could not load withdrawals</h3>
                        <p>Please refresh the page and try again.</p>
                    </div>
                `;
                return;
            }

            const data = await res.json();

            allWithdrawals = data.withdrawals || [];

            document.getElementById("pendingWithdrawals").textContent = money(data.pending_total || 0);
            document.getElementById("paidWithdrawals").textContent = money(data.paid_total || 0);
            document.getElementById("rejectedWithdrawals").textContent = data.rejected_count || 0;

            renderWithdrawals();

        } catch (error) {
            console.error("Withdrawal history error:", error);
        }
    }

    function statusIcon(status) {
        if (status === "paid") return "fa-circle-check";
        if (status === "rejected") return "fa-circle-xmark";
        return "fa-clock";
    }

    function statusText(status) {
        if (status === "paid") return "Paid";
        if (status === "rejected") return "Rejected";
        return "Pending";
    }

    function renderWithdrawals() {
        if (!withdrawHistoryList) return;

        let withdrawals = allWithdrawals;

        if (activeFilter !== "all") {
            withdrawals = allWithdrawals.filter(item => item.status === activeFilter);
        }

        if (!withdrawals.length) {
            withdrawHistoryList.innerHTML = `
                <div class="empty-withdraw">
                    <i class="fa fa-wallet"></i>
                    <h3>No ${activeFilter === "all" ? "" : activeFilter} withdrawals</h3>
                    <p>Your withdrawal requests will appear here.</p>
                </div>
            `;
            return;
        }

        withdrawHistoryList.innerHTML = withdrawals.map(item => `
            <div class="withdraw-card">
                <div>
                    <span class="withdraw-status ${item.status}">
                        <i class="fa ${statusIcon(item.status)}"></i>
                        ${statusText(item.status)}
                    </span>

                    <h3>${item.method || "Withdrawal"}</h3>

                    <p>
                        <i class="fa fa-calendar"></i>
                        Requested: ${item.created_at}
                    </p>

                    ${
                        item.paid_at
                            ? `<p><i class="fa fa-circle-check"></i> Paid: ${item.paid_at}</p>`
                            : `<p><i class="fa fa-hourglass-half"></i> Waiting for admin review</p>`
                    }
                </div>

                <div class="withdraw-amount">
                    <strong>${money(item.amount)}</strong>
                </div>
            </div>
        `).join("");
    }

    withdrawTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            withdrawTabs.forEach(btn => btn.classList.remove("active"));
            tab.classList.add("active");
            activeFilter = tab.dataset.status;
            renderWithdrawals();
        });
    });

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

            const data = await response.json();

            if (!response.ok || !data.success) {
                msg.textContent = data.message || "Withdrawal request failed.";
                msg.className = "withdraw-msg error";
                return;
            }

            msg.textContent = data.message || "Withdrawal request submitted and marked as pending.";
            msg.className = "withdraw-msg success";

            loadUser();
            loadWithdrawals();

            setTimeout(() => {
                const modal = form.closest(".modal-overlay");
                closeModal(modal);
            }, 1200);

        } catch (error) {
            console.error("Withdrawal submit error:", error);
            msg.textContent = "Network error. Please try again.";
            msg.className = "withdraw-msg error";
        } finally {
            button.disabled = false;
            button.textContent = "Submit Withdrawal";
        }
    }

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

    loadUser();
    loadWithdrawals();
});