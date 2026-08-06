document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("bankDetailsForm");
    const msg = document.getElementById("bankMsg");
    const saveBtn = document.getElementById("saveBankBtn");

    const accountNameInput = document.getElementById("accountName");
    const bankNameInput = document.getElementById("bankName");
    const sortCodeInput = document.getElementById("sortCode");
    const accountNumberInput = document.getElementById("accountNumber");

    const savedBankStatus = document.getElementById("savedBankStatus");
    const savedBankSummary = document.getElementById("savedBankSummary");

    const country = (
        form?.dataset.country || ""
    ).trim().toLowerCase();

    const isNigeria =
        country === "nigeria" ||
        country === "ng" ||
        country === "nga" ||
        country.includes("nigeria");

    let nigerianBanks = [];
    let savedBankCode = "";

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

    function showMessage(text, type = "error") {
        if (!msg) return;

        msg.hidden = false;
        msg.textContent = text;
        msg.className = `bank-message ${type}`;
    }

    function clearMessage() {
        if (!msg) return;

        msg.hidden = true;
        msg.textContent = "";
        msg.className = "bank-message";
    }

    async function parseJson(response) {
        const contentType =
            response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            return {};
        }

        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    function formatSortCode(value) {
        const digits = String(value || "")
            .replace(/\D/g, "")
            .slice(0, 6);

        const parts = [];

        if (digits.length > 0) {
            parts.push(digits.slice(0, 2));
        }

        if (digits.length > 2) {
            parts.push(digits.slice(2, 4));
        }

        if (digits.length > 4) {
            parts.push(digits.slice(4, 6));
        }

        return parts.join("-");
    }

    function maskedAccount(value) {
        const digits = String(value || "").replace(/\D/g, "");

        if (!digits) {
            return "";
        }

        return `••••••${digits.slice(-4)}`;
    }

    function showSavedBank(data) {
        const bankName = data.bank_name || "";
        const accountNumber = data.account_number || "";

        if (
            !savedBankStatus ||
            !savedBankSummary ||
            !bankName ||
            !accountNumber
        ) {
            if (savedBankStatus) {
                savedBankStatus.hidden = true;
            }

            return;
        }

        savedBankSummary.textContent =
            `${bankName} · ${maskedAccount(accountNumber)}`;

        savedBankStatus.hidden = false;
    }

    async function loadNigerianBanks(selectedCode = "") {
        if (!isNigeria || !(bankNameInput instanceof HTMLSelectElement)) {
            return;
        }

        bankNameInput.disabled = true;
        bankNameInput.innerHTML = `
            <option value="">Loading Nigerian banks...</option>
        `;

        try {
            const response = await fetch(
                "/api/nigerian-banks/",
                {
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const data = await parseJson(response);

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Could not load Nigerian banks."
                );
            }

            nigerianBanks = Array.isArray(data.banks)
                ? data.banks
                : [];

            bankNameInput.innerHTML = `
                <option value="">Select your bank</option>
                ${nigerianBanks.map((bank) => `
                    <option
                        value="${String(bank.code || "")
                            .replaceAll('"', "&quot;")}"
                    >
                        ${String(bank.name || "")}
                    </option>
                `).join("")}
            `;

            if (selectedCode) {
                bankNameInput.value = selectedCode;
            }

        } catch (error) {
            console.error(
                "NIGERIAN BANK LIST ERROR:",
                error
            );

            bankNameInput.innerHTML = `
                <option value="">
                    Unable to load banks
                </option>
            `;

            showMessage(
                error.message ||
                "Could not load Nigerian banks."
            );

        } finally {
            bankNameInput.disabled = false;
        }
    }

    sortCodeInput?.addEventListener("input", () => {
        sortCodeInput.value =
            formatSortCode(sortCodeInput.value);
    });

    accountNumberInput?.addEventListener("input", () => {
        accountNumberInput.value =
            accountNumberInput.value
                .replace(/\D/g, "")
                .slice(0, isNigeria ? 10 : 8);
    });

    async function loadBankDetails() {
        try {
            const response = await fetch(
                "/api/bank-details/",
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const data = await parseJson(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Could not load bank details."
                );
            }

            savedBankCode = data.bank_code || "";

            if (accountNameInput) {
                accountNameInput.value =
                    data.account_name || "";
            }

            if (isNigeria) {
                await loadNigerianBanks(savedBankCode);
            } else if (bankNameInput) {
                bankNameInput.value =
                    data.bank_name || "";
            }

            if (sortCodeInput) {
                sortCodeInput.value =
                    formatSortCode(
                        data.sort_code || ""
                    );
            }

            if (accountNumberInput) {
                accountNumberInput.value =
                    String(data.account_number || "")
                        .replace(/\D/g, "")
                        .slice(0, isNigeria ? 10 : 8);
            }

            showSavedBank(data);

        } catch (error) {
            console.error(
                "BANK DETAILS LOAD ERROR:",
                error
            );

            if (isNigeria) {
                await loadNigerianBanks();
            }

            showMessage(
                error.message ||
                "Could not load your saved bank details."
            );
        }
    }

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage();

        const accountName =
            accountNameInput?.value.trim() || "";

        const accountNumber =
            accountNumberInput?.value
                .replace(/\D/g, "") || "";

        const sortCode =
            sortCodeInput?.value
                .replace(/\D/g, "") || "";

        let bankName = "";
        let bankCode = "";

        if (isNigeria) {
            bankCode = bankNameInput?.value || "";

            const selectedBank = nigerianBanks.find(
                (bank) =>
                    String(bank.code) === String(bankCode)
            );

            bankName = selectedBank?.name || "";
        } else {
            bankName =
                bankNameInput?.value.trim() || "";
        }

        if (!accountName) {
            showMessage(
                "Account name is required."
            );
            return;
        }

        if (!bankName) {
            showMessage(
                isNigeria
                    ? "Select your bank."
                    : "Bank name is required."
            );
            return;
        }

        if (
            isNigeria &&
            accountNumber.length !== 10
        ) {
            showMessage(
                "Enter a valid 10-digit Nigerian account number."
            );
            return;
        }

        if (
            !isNigeria &&
            sortCode.length !== 6
        ) {
            showMessage(
                "Enter a valid 6-digit sort code."
            );
            return;
        }

        if (
            !isNigeria &&
            accountNumber.length !== 8
        ) {
            showMessage(
                "Enter a valid 8-digit UK account number."
            );
            return;
        }

        const payload = {
            account_name: accountName,
            bank_name: bankName,
            bank_code: bankCode,
            account_number: accountNumber,
        };

        if (!isNigeria) {
            payload.sort_code = sortCode;
        }

        const originalButton =
            saveBtn?.innerHTML;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Saving...</span>
            `;
        }

        try {
            const response = await fetch(
                "/api/bank-details/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "X-CSRFToken":
                            getCookie("csrftoken"),
                        "X-Requested-With":
                            "XMLHttpRequest",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data =
                await parseJson(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Bank details update failed."
                );
            }

            savedBankCode = data.bank_code || bankCode;

            showMessage(
                data.message ||
                "Bank details saved successfully.",
                "success"
            );

            showSavedBank(data);

        } catch (error) {
            console.error(
                "BANK DETAILS SAVE ERROR:",
                error
            );

            showMessage(
                error.message ||
                "Could not save your bank details."
            );

        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML =
                    originalButton;
            }
        }
    });

    loadBankDetails();
});
