document.addEventListener("DOMContentLoaded", () => {
    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    const form = document.getElementById("withdrawForm");
    const amountInput = document.getElementById("amount");
    const accountNameInput = document.getElementById("accountName");
    const sortCodeInput = document.getElementById("sortCode");
    const accountNumberInput = document.getElementById("accountNumber");
    const withdrawBtn = document.getElementById("withdrawBtn");
    const withdrawMsg = document.getElementById("withdrawMsg");

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = "/login/";
                return;
            }

            if (!res.ok) return;

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("balanceAmount", money(data.balance));

        } catch (err) {
            console.error("User load error:", err);
        }
    }

    sortCodeInput?.addEventListener("input", () => {
        sortCodeInput.value = sortCodeInput.value.replace(/[^\d-]/g, "");
    });

    accountNumberInput?.addEventListener("input", () => {
        accountNumberInput.value = accountNumberInput.value.replace(/[^\d]/g, "");
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const amount = amountInput.value.trim();
        const account_name = accountNameInput.value.trim();
        const sort_code = sortCodeInput.value.trim();
        const account_number = accountNumberInput.value.trim();

        if (!amount || Number(amount) <= 0) {
            withdrawMsg.textContent = "Enter a valid amount.";
            return;
        }

        if (!account_name || !sort_code || !account_number) {
            withdrawMsg.textContent = "Complete all bank details.";
            return;
        }

        withdrawBtn.disabled = true;
        withdrawBtn.textContent = "Submitting...";
        withdrawMsg.textContent = "";

        try {
            const res = await fetch("/api/request-withdrawal/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount,
                    account_name,
                    sort_code,
                    account_number
                })
            });

            const data = await res.json();

            if (!res.ok) {
                withdrawMsg.textContent = data.error || "Withdrawal failed.";
                return;
            }

            withdrawMsg.textContent = data.message || "Withdrawal request submitted.";
            setText("balanceAmount", money(data.new_balance));

            form.reset();

        } catch (err) {
            console.error("Withdrawal error:", err);
            withdrawMsg.textContent = "Network error. Try again.";
        } finally {
            withdrawBtn.disabled = false;
            withdrawBtn.textContent = "Submit Withdrawal";
        }
    });

    loadUser();
});