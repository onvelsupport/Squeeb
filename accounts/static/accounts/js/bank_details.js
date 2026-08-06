document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById("bankDetailsForm");

    const msg =
        document.getElementById("bankMsg");

    const saveBtn =
        document.getElementById("saveBankBtn");

    const accountNameInput =
        document.getElementById("accountName");

    const bankNameInput =
        document.getElementById("bankName");

    const sortCodeInput =
        document.getElementById("sortCode");

    const accountNumberInput =
        document.getElementById("accountNumber");


    const country = (
        form?.dataset.country || ""
    ).trim().toLowerCase();


    const isNigeria =
        country === "nigeria" ||
        country === "ng" ||
        country.includes("nigeria");


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


    function showMessage(
        text,
        type = "error"
    ) {
        if (!msg) {
            return;
        }

        msg.hidden = false;
        msg.textContent = text;
        msg.className =
            `bank-message ${type}`;
    }


    function clearMessage() {
        if (!msg) {
            return;
        }

        msg.hidden = true;
        msg.textContent = "";
        msg.className = "bank-message";
    }


    async function parseJson(response) {
        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            !contentType.includes(
                "application/json"
            )
        ) {
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
            parts.push(
                digits.slice(0, 2)
            );
        }

        if (digits.length > 2) {
            parts.push(
                digits.slice(2, 4)
            );
        }

        if (digits.length > 4) {
            parts.push(
                digits.slice(4, 6)
            );
        }

        return parts.join("-");
    }


    sortCodeInput?.addEventListener(
        "input",
        () => {
            sortCodeInput.value =
                formatSortCode(
                    sortCodeInput.value
                );
        }
    );


    accountNumberInput?.addEventListener(
        "input",
        () => {
            accountNumberInput.value =
                accountNumberInput.value
                    .replace(/\D/g, "")
                    .slice(
                        0,
                        isNigeria ? 10 : 8
                    );
        }
    );


    async function loadBankDetails() {
        try {
            const response = await fetch(
                "/api/bank-details/",
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        Accept:
                            "application/json",
                    },
                }
            );

            const data =
                await parseJson(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Could not load bank details."
                );
            }


            if (accountNameInput) {
                accountNameInput.value =
                    data.account_name || "";
            }


            if (bankNameInput) {
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
                    String(
                        data.account_number || ""
                    )
                        .replace(/\D/g, "")
                        .slice(
                            0,
                            isNigeria ? 10 : 8
                        );
            }

        } catch (error) {

            console.error(
                "BANK DETAILS LOAD ERROR:",
                error
            );

            showMessage(
                error.message ||
                "Could not load your saved bank details."
            );
        }
    }


    form?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            clearMessage();


            const accountName =
                accountNameInput?.value
                    .trim() || "";

            const bankName =
                bankNameInput?.value
                    .trim() || "";

            const accountNumber =
                accountNumberInput?.value
                    .replace(/\D/g, "") || "";

            const sortCode =
                sortCodeInput?.value
                    .replace(/\D/g, "") || "";


            if (!accountName) {
                showMessage(
                    "Account name is required."
                );

                return;
            }


            if (!bankName) {
                showMessage(
                    "Bank name is required."
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
                account_name:
                    accountName,

                bank_name:
                    bankName,

                account_number:
                    accountNumber,

                country:
                    isNigeria
                        ? "Nigeria"
                        : country,
            };


            if (!isNigeria) {
                payload.sort_code =
                    sortCode;
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

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json",

                            "X-CSRFToken":
                                getCookie(
                                    "csrftoken"
                                ),

                            "X-Requested-With":
                                "XMLHttpRequest",
                        },

                        body: JSON.stringify(
                            payload
                        ),
                    }
                );


                const data =
                    await parseJson(
                        response
                    );


                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        data.message ||
                        "Bank details update failed."
                    );
                }


                showMessage(
                    data.message ||
                    "Bank details saved successfully.",
                    "success"
                );


                if (
                    sortCodeInput &&
                    data.sort_code
                ) {
                    sortCodeInput.value =
                        formatSortCode(
                            data.sort_code
                        );
                }

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
        }
    );


    loadBankDetails();
});
