document.addEventListener("DOMContentLoaded", () => {
    const money = (value) =>
        `£${parseFloat(value || 0).toFixed(2)}`;

    const bankModal = document.getElementById("bankModal");
    const paypalModal = document.getElementById("paypalModal");

    const openBankModal = document.getElementById("openBankModal");
    const openPaypalModal = document.getElementById("openPaypalModal");

    const withdrawHistoryList = document.getElementById(
        "withdrawHistoryList"
    );

    const withdrawTabs = document.querySelectorAll(
        ".withdraw-tab"
    );

    const withdrawalStatusTitle = document.getElementById(
        "withdrawalStatusTitle"
    );

    const withdrawalStatusMessage = document.getElementById(
        "withdrawalStatusMessage"
    );

    const currentWithdrawalFee = document.getElementById(
        "currentWithdrawalFee"
    );

    const activateMembershipBtn = document.getElementById(
        "activateMembershipBtn"
    );

    const membershipActiveBadge = document.getElementById(
        "membershipActiveBadge"
    );

    const membershipRequiredNotice = document.getElementById(
        "membershipRequiredNotice"
    );

    const paypalOptionFee = document.getElementById(
        "paypalOptionFee"
    );

    const bankWithdrawalAmount = document.getElementById(
        "bankWithdrawalAmount"
    );

    const paypalWithdrawalAmount = document.getElementById(
        "paypalWithdrawalAmount"
    );

    let allWithdrawals = [];
    let activeFilter = "all";

    let currentFeePercentage = 20;
    let membershipRequired = false;
    let currentBalance = 0;

    // ==========================================================
    // MODALS
    // ==========================================================

    openBankModal?.addEventListener("click", () => {
        if (
            openBankModal.disabled ||
            openBankModal.classList.contains("membership-locked")
        ) {
            return;
        }

        bankModal?.classList.add("show");
    });

    openPaypalModal?.addEventListener("click", () => {
        if (
            openPaypalModal.disabled ||
            openPaypalModal.classList.contains("membership-locked")
        ) {
            alert(
                "Activate SQUEEB Membership before making another withdrawal."
            );

            return;
        }

        paypalModal?.classList.add("show");
    });

    function closeModal(modal) {
        if (!modal) {
            return;
        }

        modal.classList.remove("show");

        const form = modal.querySelector("form");
        const message = modal.querySelector(".withdraw-msg");

        form?.reset();

        if (message) {
            message.textContent = "";
            message.className = "withdraw-msg";
        }

        resetCalculation(modal);
    }

    document.querySelectorAll(".close-modal").forEach((button) => {
        button.addEventListener("click", () => {
            const modal = document.getElementById(
                button.dataset.close
            );

            closeModal(modal);
        });
    });

    document.querySelectorAll(".modal-overlay").forEach((modal) => {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        closeModal(bankModal);
        closeModal(paypalModal);
    });

    // ==========================================================
    // USER INFORMATION
    // ==========================================================

    async function loadUser() {
        try {
            const response = await fetch("/api/user-info/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (
                response.status === 401 ||
                response.status === 403 ||
                response.redirected
            ) {
                window.location.href = "/login/";
                return;
            }

            if (!response.ok) {
                console.error(
                    "USER INFO ERROR:",
                    response.status
                );

                return;
            }

            const user = await response.json();

            currentBalance = parseFloat(user.balance || 0);

            const usernameDisplay = document.getElementById(
                "usernameDisplay"
            );

            const balanceAmount = document.getElementById(
                "balanceAmount"
            );

            if (usernameDisplay) {
                usernameDisplay.textContent =
                    user.username || "User";
            }

            if (balanceAmount) {
                balanceAmount.textContent = money(
                    user.balance
                );
            }

            updateWithdrawalStatus(user);

        } catch (error) {
            console.error(
                "USER LOAD ERROR:",
                error
            );
        }
    }

    // ==========================================================
    // WITHDRAWAL STATUS
    // ==========================================================

    function updateWithdrawalStatus(user) {
        /*
         * First withdrawal:
         * - No membership required
         * - 20% fee
         */
        if (!user.first_withdrawal_completed) {
            currentFeePercentage = 20;
            membershipRequired = false;

            if (withdrawalStatusTitle) {
                withdrawalStatusTitle.textContent =
                    "Your first withdrawal is available";
            }

            if (withdrawalStatusMessage) {
                withdrawalStatusMessage.textContent =
                    "Membership is not required for your first withdrawal. " +
                    "A 20% withdrawal fee will apply.";
            }

            if (currentWithdrawalFee) {
                currentWithdrawalFee.textContent = "20%";
            }

            if (paypalOptionFee) {
                paypalOptionFee.textContent = "20%";
            }

            if (activateMembershipBtn) {
                activateMembershipBtn.style.display = "none";
            }

            if (membershipActiveBadge) {
                membershipActiveBadge.style.display = "none";
            }

            if (membershipRequiredNotice) {
                membershipRequiredNotice.style.display = "none";
            }

            unlockWithdrawalOptions();
            updateAllCalculations();

            return;
        }

        /*
         * After the first withdrawal:
         * - User may continue earning
         * - Membership required for another withdrawal
         */
        if (!user.is_member) {
            currentFeePercentage = 10;
            membershipRequired = true;

            if (withdrawalStatusTitle) {
                withdrawalStatusTitle.textContent =
                    "Activate membership to withdraw again";
            }

            if (withdrawalStatusMessage) {
                withdrawalStatusMessage.textContent =
                    "Your first withdrawal has been completed. " +
                    "Activate SQUEEB Membership before requesting another withdrawal.";
            }

            if (currentWithdrawalFee) {
                currentWithdrawalFee.textContent = "10%";
            }

            if (paypalOptionFee) {
                paypalOptionFee.textContent = "10%";
            }

            if (activateMembershipBtn) {
                activateMembershipBtn.style.display = "block";
            }

            if (membershipActiveBadge) {
                membershipActiveBadge.style.display = "none";
            }

            if (membershipRequiredNotice) {
                membershipRequiredNotice.style.display = "flex";
            }

            lockWithdrawalOptions();
            updateAllCalculations();

            return;
        }

        /*
         * Active members:
         * - Future withdrawals allowed
         * - 10% fee
         */
        currentFeePercentage = 10;
        membershipRequired = false;

        if (withdrawalStatusTitle) {
            withdrawalStatusTitle.textContent =
                "Membership active";
        }

        if (withdrawalStatusMessage) {
            withdrawalStatusMessage.textContent =
                "You can make future withdrawals with a reduced 10% fee.";
        }

        if (currentWithdrawalFee) {
            currentWithdrawalFee.textContent = "10%";
        }

        if (paypalOptionFee) {
            paypalOptionFee.textContent = "10%";
        }

        if (activateMembershipBtn) {
            activateMembershipBtn.style.display = "none";
        }

        if (membershipActiveBadge) {
            membershipActiveBadge.style.display = "flex";
        }

        if (membershipRequiredNotice) {
            membershipRequiredNotice.style.display = "none";
        }

        unlockWithdrawalOptions();
        updateAllCalculations();
    }

    function lockWithdrawalOptions() {
        if (openPaypalModal) {
            openPaypalModal.classList.add(
                "membership-locked"
            );

            openPaypalModal.setAttribute(
                "aria-disabled",
                "true"
            );
        }
    }

    function unlockWithdrawalOptions() {
        if (openPaypalModal) {
            openPaypalModal.classList.remove(
                "membership-locked"
            );

            openPaypalModal.removeAttribute(
                "aria-disabled"
            );
        }
    }

    // ==========================================================
    // MEMBERSHIP ACTIVATION
    // ==========================================================

    activateMembershipBtn?.addEventListener(
        "click",
        async () => {
            activateMembershipBtn.disabled = true;
            activateMembershipBtn.textContent =
                "Processing...";

            try {
                const response = await fetch(
                    "/pay-membership/",
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Accept": "application/json",
                            "X-CSRFToken": getCookie(
                                "csrftoken"
                            ),
                            "X-Requested-With":
                                "XMLHttpRequest"
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    alert(
                        data.error ||
                        data.message ||
                        "Membership activation failed."
                    );

                    return;
                }

                alert(
                    data.message ||
                    "Membership activated successfully."
                );

                await loadUser();

            } catch (error) {
                console.error(
                    "MEMBERSHIP ERROR:",
                    error
                );

                alert(
                    "Network error. Please try again."
                );

            } finally {
                activateMembershipBtn.disabled = false;
                activateMembershipBtn.textContent =
                    "Activate Membership";
            }
        }
    );

    // ==========================================================
    // FEE CALCULATIONS
    // ==========================================================

    function calculateWithdrawal(amount) {
        const requestedAmount = parseFloat(amount || 0);

        if (
            Number.isNaN(requestedAmount) ||
            requestedAmount <= 0
        ) {
            return {
                requested: 0,
                fee: 0,
                net: 0
            };
        }

        const fee =
            requestedAmount *
            (currentFeePercentage / 100);

        const net = requestedAmount - fee;

        return {
            requested: requestedAmount,
            fee,
            net
        };
    }

    function updateCalculation(type, amount) {
        const calculation = calculateWithdrawal(amount);

        const requestedElement = document.getElementById(
            `${type}RequestedAmount`
        );

        const feePercentageElement = document.getElementById(
            `${type}FeePercentage`
        );

        const feeAmountElement = document.getElementById(
            `${type}FeeAmount`
        );

        const netAmountElement = document.getElementById(
            `${type}NetAmount`
        );

        if (requestedElement) {
            requestedElement.textContent = money(
                calculation.requested
            );
        }

        if (feePercentageElement) {
            feePercentageElement.textContent =
                `${currentFeePercentage}%`;
        }

        if (feeAmountElement) {
            feeAmountElement.textContent = money(
                calculation.fee
            );
        }

        if (netAmountElement) {
            netAmountElement.textContent = money(
                calculation.net
            );
        }
    }

    function updateAllCalculations() {
        updateCalculation(
            "bank",
            bankWithdrawalAmount?.value
        );

        updateCalculation(
            "paypal",
            paypalWithdrawalAmount?.value
        );
    }

    function resetCalculation(modal) {
        if (modal === bankModal) {
            updateCalculation("bank", 0);
        }

        if (modal === paypalModal) {
            updateCalculation("paypal", 0);
        }
    }

    bankWithdrawalAmount?.addEventListener(
        "input",
        () => {
            updateCalculation(
                "bank",
                bankWithdrawalAmount.value
            );
        }
    );

    paypalWithdrawalAmount?.addEventListener(
        "input",
        () => {
            updateCalculation(
                "paypal",
                paypalWithdrawalAmount.value
            );
        }
    );

    // ==========================================================
    // WITHDRAWAL HISTORY
    // ==========================================================

    async function loadWithdrawals() {
        if (!withdrawHistoryList) {
            return;
        }

        try {
            const response = await fetch(
                "/api/withdrawal-history/",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                withdrawHistoryList.innerHTML = `
                    <div class="empty-withdraw">
                        <i class="fa fa-triangle-exclamation"></i>

                        <h3>Could not load withdrawals</h3>

                        <p>
                            Please refresh the page and try again.
                        </p>
                    </div>
                `;

                return;
            }

            const data = await response.json();

            allWithdrawals =
                data.withdrawals || [];

            setText(
                "pendingWithdrawals",
                money(data.pending_total || 0)
            );

            setText(
                "paidWithdrawals",
                money(data.paid_total || 0)
            );

            setText(
                "rejectedWithdrawals",
                data.rejected_count || 0
            );

            renderWithdrawals();

        } catch (error) {
            console.error(
                "WITHDRAWAL HISTORY ERROR:",
                error
            );

            withdrawHistoryList.innerHTML = `
                <div class="empty-withdraw">
                    <i class="fa fa-wifi"></i>

                    <h3>Network error</h3>

                    <p>
                        Check your connection and try again.
                    </p>
                </div>
            `;
        }
    }

    function statusIcon(status) {
        if (status === "paid") {
            return "fa-circle-check";
        }

        if (status === "rejected") {
            return "fa-circle-xmark";
        }

        return "fa-clock";
    }

    function statusText(status) {
        if (status === "paid") {
            return "Paid";
        }

        if (status === "rejected") {
            return "Rejected";
        }

        return "Pending";
    }

    function escapeHtml(value) {
        const div = document.createElement("div");

        div.textContent = value || "";

        return div.innerHTML;
    }

    function renderWithdrawals() {
        if (!withdrawHistoryList) {
            return;
        }

        let withdrawals = allWithdrawals;

        if (activeFilter !== "all") {
            withdrawals = allWithdrawals.filter(
                (item) =>
                    item.status === activeFilter
            );
        }

        if (!withdrawals.length) {
            withdrawHistoryList.innerHTML = `
                <div class="empty-withdraw">
                    <i class="fa fa-wallet"></i>

                    <h3>
                        No ${
                            activeFilter === "all"
                                ? ""
                                : activeFilter
                        } withdrawals
                    </h3>

                    <p>
                        Your withdrawal requests will appear here.
                    </p>
                </div>
            `;

            return;
        }

        withdrawHistoryList.innerHTML = withdrawals
            .map((item) => {
                const amount = parseFloat(
                    item.amount || 0
                );

                const feePercentage = parseFloat(
                    item.fee_percentage || 0
                );

                const feeAmount = parseFloat(
                    item.fee_amount || 0
                );

                const netAmount = parseFloat(
                    item.net_amount || 0
                );

                return `
                    <div class="withdraw-card">

                        <div class="withdraw-card-details">

                            <span class="
                                withdraw-status
                                ${escapeHtml(item.status)}
                            ">
                                <i class="
                                    fa
                                    ${statusIcon(item.status)}
                                "></i>

                                ${statusText(item.status)}
                            </span>

                            <h3>
                                ${escapeHtml(
                                    item.method ||
                                    "Withdrawal"
                                )}
                            </h3>

                            <p>
                                <i class="fa fa-calendar"></i>

                                Requested:
                                ${escapeHtml(
                                    item.created_at ||
                                    ""
                                )}
                            </p>

                            ${
                                item.paid_at
                                    ? `
                                        <p>
                                            <i class="
                                                fa
                                                fa-circle-check
                                            "></i>

                                            Paid:
                                            ${escapeHtml(
                                                item.paid_at
                                            )}
                                        </p>
                                    `
                                    : item.status === "rejected"
                                        ? `
                                            <p>
                                                <i class="
                                                    fa
                                                    fa-circle-xmark
                                                "></i>

                                                Request rejected
                                            </p>
                                        `
                                        : `
                                            <p>
                                                <i class="
                                                    fa
                                                    fa-hourglass-half
                                                "></i>

                                                Waiting for admin review
                                            </p>
                                        `
                            }

                        </div>

                        <div class="withdraw-amount-breakdown">

                            <span>
                                Requested amount
                            </span>

                            <strong>
                                ${money(amount)}
                            </strong>

                            <div class="withdraw-fee-details">

                                <span>
                                    Fee:
                                    ${feePercentage.toFixed(0)}%
                                    (${money(feeAmount)})
                                </span>

                                <span>
                                    You receive:
                                    ${money(netAmount)}
                                </span>

                            </div>

                        </div>

                    </div>
                `;
            })
            .join("");
    }

    withdrawTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            withdrawTabs.forEach((button) => {
                button.classList.remove("active");
            });

            tab.classList.add("active");

            activeFilter =
                tab.dataset.status || "all";

            renderWithdrawals();
        });
    });

    // ==========================================================
    // SUBMIT WITHDRAWAL
    // ==========================================================

    async function submitWithdrawal(form) {
        const message = form.querySelector(
            ".withdraw-msg"
        );

        const button = form.querySelector(
            "button[type='submit']"
        );

        const amountInput = form.querySelector(
            "input[name='amount']"
        );

        if (!message || !button || !amountInput) {
            return;
        }

        message.textContent = "";
        message.className = "withdraw-msg";

        if (membershipRequired) {
            message.textContent =
                "Activate membership before requesting another withdrawal.";

            message.className =
                "withdraw-msg error";

            return;
        }

        const amount = parseFloat(
            amountInput.value || 0
        );

        if (
            Number.isNaN(amount) ||
            amount < 10
        ) {
            message.textContent =
                "Minimum withdrawal amount is £10.00.";

            message.className =
                "withdraw-msg error";

            return;
        }

        if (amount > currentBalance) {
            message.textContent =
                "The withdrawal amount exceeds your available balance.";

            message.className =
                "withdraw-msg error";

            return;
        }

        button.disabled = true;
        button.textContent = "Submitting...";

        const formData = new FormData(form);

        try {
            const response = await fetch(
                "/request-withdrawal/",
                {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                    headers: {
                        "X-CSRFToken": getCookie(
                            "csrftoken"
                        ),
                        "X-Requested-With":
                            "XMLHttpRequest"
                    }
                }
            );

            const data = await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                if (data.membership_required) {
                    membershipRequired = true;

                    await loadUser();
                }

                message.textContent =
                    data.message ||
                    "Withdrawal request failed.";

                message.className =
                    "withdraw-msg error";

                return;
            }

            message.textContent =
                data.message ||
                "Withdrawal request submitted successfully.";

            message.className =
                "withdraw-msg success";

            await loadUser();
            await loadWithdrawals();

            setTimeout(() => {
                const modal = form.closest(
                    ".modal-overlay"
                );

                closeModal(modal);
            }, 1200);

        } catch (error) {
            console.error(
                "WITHDRAWAL SUBMIT ERROR:",
                error
            );

            message.textContent =
                "Network error. Please try again.";

            message.className =
                "withdraw-msg error";

        } finally {
            button.disabled = false;
            button.textContent =
                "Submit Withdrawal";
        }
    }

    const bankWithdrawForm = document.getElementById(
        "bankWithdrawForm"
    );

    const paypalWithdrawForm = document.getElementById(
        "paypalWithdrawForm"
    );

    bankWithdrawForm?.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            submitWithdrawal(
                bankWithdrawForm
            );
        }
    );

    paypalWithdrawForm?.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            submitWithdrawal(
                paypalWithdrawForm
            );
        }
    );

    // ==========================================================
    // HELPERS
    // ==========================================================

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function getCookie(name) {
        let cookieValue = null;

        if (
            document.cookie &&
            document.cookie !== ""
        ) {
            const cookies =
                document.cookie.split(";");

            for (let cookie of cookies) {
                cookie = cookie.trim();

                if (
                    cookie.startsWith(
                        `${name}=`
                    )
                ) {
                    cookieValue =
                        decodeURIComponent(
                            cookie.substring(
                                name.length + 1
                            )
                        );

                    break;
                }
            }
        }

        return cookieValue;
    }

    // ==========================================================
    // INITIAL LOAD
    // ==========================================================

    loadUser();
    loadWithdrawals();
});