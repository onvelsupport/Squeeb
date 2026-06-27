document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bankDetailsForm");
    const msg = document.getElementById("bankMsg");

    const sortCodeInput = document.getElementById("sortCode");
    const accountNumberInput = document.getElementById("accountNumber");

    sortCodeInput?.addEventListener("input", () => {
        let value = sortCodeInput.value.replace(/\D/g, "").slice(0, 6);

        if (value.length > 4) {
            value = value.replace(/(\d{2})(\d{2})(\d{1,2})/, "$1-$2-$3");
        } else if (value.length > 2) {
            value = value.replace(/(\d{2})(\d{1,2})/, "$1-$2");
        }

        sortCodeInput.value = value;
    });

    accountNumberInput?.addEventListener("input", () => {
        accountNumberInput.value = accountNumberInput.value
            .replace(/\D/g, "")
            .slice(0, 8);
    });

    async function loadBankDetails() {
        try {
            const res = await fetch("/api/bank-details/", {
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) return;

            const data = await res.json();

            document.getElementById("accountName").value = data.account_name || "";
            document.getElementById("bankName").value = data.bank_name || "";
            document.getElementById("sortCode").value = data.sort_code || "";
            document.getElementById("accountNumber").value = data.account_number || "";

        } catch (err) {
            console.error("Bank details load error:", err);
        }
    }

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();

        msg.textContent = "Saving...";

        const payload = {
            account_name: document.getElementById("accountName").value.trim(),
            bank_name: document.getElementById("bankName").value.trim(),
            sort_code: document.getElementById("sortCode").value.trim(),
            account_number: document.getElementById("accountNumber").value.trim()
        };

        try {
            const res = await fetch("/api/bank-details/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                msg.textContent = data.error || "Bank details update failed.";
                return;
            }

            msg.textContent = data.message || "Bank details saved successfully.";

        } catch (err) {
            console.error("Bank details save error:", err);
            msg.textContent = "Network error. Try again.";
        }
    });

    loadBankDetails();
});