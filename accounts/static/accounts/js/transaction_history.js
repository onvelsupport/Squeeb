document.addEventListener("DOMContentLoaded", () => {

    const transactionList = document.getElementById("transactionList");

    function money(value) {
        return `£${parseFloat(value || 0).toFixed(2)}`;
    }

    async function loadTransactions() {
        try {
            const response = await fetch("/api/transaction-history/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                transactionList.innerHTML = `
                    <p class="error">Could not load transaction history.</p>
                `;
                return;
            }

            const data = await response.json();

            if (!data.transactions || data.transactions.length === 0) {
                transactionList.innerHTML = `
                    <p class="empty">No transactions found yet.</p>
                `;
                return;
            }

            transactionList.innerHTML = data.transactions.map(transaction => `
                <div class="transaction-item">
                    <div>
                        <h3>${transaction.type}</h3>
                        <p>${transaction.date}</p>
                        <span class="status ${transaction.status}">
                            ${transaction.status}
                        </span>
                    </div>

                    <div class="amount">
                        ${money(transaction.amount)}
                    </div>
                </div>
            `).join("");

        } catch (error) {
            transactionList.innerHTML = `
                <p class="error">Network error. Please try again.</p>
            `;
        }
    }

    loadTransactions();

});