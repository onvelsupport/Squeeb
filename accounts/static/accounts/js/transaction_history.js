document.addEventListener("DOMContentLoaded", () => {

    const transactionList = document.getElementById("transactionList");
    const transactionCount = document.getElementById("transactionCount");

    if (!transactionList) {
        return;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function money(value) {
        const amount = Number.parseFloat(value || 0);

        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
        }).format(Number.isFinite(amount) ? amount : 0);
    }

    function normalizeStatus(value) {
        return String(value || "unknown")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "");
    }

    function normalizeDirection(transaction) {
        const direction = String(
            transaction.direction ||
            transaction.flow ||
            ""
        ).toLowerCase();

        if (["credit", "in", "deposit"].includes(direction)) {
            return "credit";
        }

        if (["debit", "out", "withdrawal"].includes(direction)) {
            return "debit";
        }

        const type = String(transaction.type || "").toLowerCase();

        if (
            type.includes("deposit") ||
            type.includes("credit") ||
            type.includes("refund") ||
            type.includes("earning")
        ) {
            return "credit";
        }

        if (
            type.includes("withdraw") ||
            type.includes("payment") ||
            type.includes("debit") ||
            type.includes("purchase")
        ) {
            return "debit";
        }

        return "";
    }

    function transactionIcon(direction) {
        if (direction === "credit") {
            return "fa-arrow-down";
        }

        if (direction === "debit") {
            return "fa-arrow-up";
        }

        return "fa-receipt";
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

    function transactionMarkup(transaction) {
        const type = escapeHtml(
            transaction.type || "Transaction"
        );

        const date = escapeHtml(
            transaction.date || "Date unavailable"
        );

        const statusText = escapeHtml(
            transaction.status || "Unknown"
        );

        const statusClass = normalizeStatus(
            transaction.status
        );

        const direction = normalizeDirection(
            transaction
        );

        const icon = transactionIcon(direction);

        return `
            <article class="transaction-item">

                <div class="transaction-icon">
                    <i class="fa-solid ${icon}"></i>
                </div>

                <div class="transaction-main">

                    <h3>${type}</h3>

                    <p>${date}</p>

                    <div class="transaction-meta">
                        <span
                            class="transaction-status ${statusClass}"
                        >
                            ${statusText}
                        </span>
                    </div>

                </div>

                <div
                    class="transaction-amount ${direction}"
                >
                    <span>Amount</span>
                    <strong>
                        ${money(transaction.amount)}
                    </strong>
                </div>

            </article>
        `;
    }

    async function loadTransactions() {
        try {
            const response = await fetch(
                "/api/transaction-history/",
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
                    "Could not load transaction history."
                );
            }

            const transactions = Array.isArray(data.transactions)
                ? data.transactions
                : [];

            if (transactionCount) {
                transactionCount.textContent =
                    `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
            }

            if (!transactions.length) {
                transactionList.innerHTML = `
                    <div class="transaction-state">
                        <i class="fa-solid fa-receipt"></i>
                        <h3>No transactions yet</h3>
                        <p>
                            Your wallet activity will appear here
                            once you make or receive a transaction.
                        </p>
                    </div>
                `;
                return;
            }

            transactionList.innerHTML = transactions
                .map(transactionMarkup)
                .join("");

        } catch (error) {
            console.error(
                "TRANSACTION HISTORY ERROR:",
                error
            );

            if (transactionCount) {
                transactionCount.textContent = "Unavailable";
            }

            transactionList.innerHTML = `
                <div class="transaction-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>Could not load transactions</h3>
                    <p>
                        ${escapeHtml(
                            error.message ||
                            "Please try again."
                        )}
                    </p>
                </div>
            `;
        }
    }

    loadTransactions();
});
