document.addEventListener("DOMContentLoaded", () => {
    const MINIMUM_WITHDRAWAL = 10;
    let currentFeePercentage = 20;
    let allWithdrawals = [];
    let availableBalance = 0;

    const byId = (id) => document.getElementById(id);

    const money = (value) => {
        const amount = Number.parseFloat(value || 0);
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
        }).format(Number.isFinite(amount) ? amount : 0);
    };

    const escapeHtml = (value) => {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    };

    const setText = (id, value) => {
        const element = byId(id);
        if (element) element.textContent = value;
    };

    const getCookie = (name) => {
        const cookie = document.cookie
            .split(";")
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`));

        return cookie ? decodeURIComponent(cookie.split("=")[1]) : "";
    };

    const getErrorMessage = async (response) => {
        try {
            const data = await response.json();
            return data.message || data.error || "Something went wrong.";
        } catch {
            return "Something went wrong. Please try again.";
        }
    };

    function openModal(modalId) {
        const modal = byId(modalId);
        if (!modal) return;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        const firstInput = modal.querySelector("input:not([type='hidden'])");
        window.setTimeout(() => firstInput?.focus(), 50);
    }

    function closeModal(modalId) {
        const modal = byId(modalId);
        if (!modal) return;

        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    function updateFeeDisplay(fee) {
        currentFeePercentage = Number.parseFloat(fee) || 0;
        const label = `${currentFeePercentage}%`;

        setText("summaryFee", label);
        setText("currentWithdrawalFee", label);
        setText("paypalOptionFee", label);
        setText("paypalFeePercentage", label);

        calculatePaypalWithdrawal();
    }

    function calculatePaypalWithdrawal() {
        const amountInput = byId("paypalWithdrawalAmount");
        const amount = Number.parseFloat(amountInput?.value || 0);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        const feeAmount = safeAmount * (currentFeePercentage / 100);
        const netAmount = Math.max(0, safeAmount - feeAmount);

        setText("paypalRequestedAmount", money(safeAmount));
        setText("paypalFeeAmount", money(feeAmount));
        setText("paypalNetAmount", money(netAmount));
    }

    function updateMembershipState(user) {
        const firstCompleted = Boolean(
            user.first_withdrawal_completed ??
            user.firstWithdrawalCompleted
        );

        const isMember = Boolean(user.is_member ?? user.isMember);
        const notice = byId("membershipRequiredNotice");
        const activeBadge = byId("membershipActiveBadge");

        updateFeeDisplay(firstCompleted ? 10 : 20);

        if (!firstCompleted) {
            setText(
                "withdrawalStatusTitle",
                "Your first withdrawal is available"
            );
            setText(
                "withdrawalStatusMessage",
                "Membership is not required. A 20% withdrawal fee applies."
            );

            if (notice) notice.hidden = true;
            if (activeBadge) activeBadge.hidden = true;
            return;
        }

        if (isMember) {
            setText("withdrawalStatusTitle", "Membership active");
            setText(
                "withdrawalStatusMessage",
                "You can request another withdrawal. A 10% fee applies."
            );

            if (notice) notice.hidden = true;
            if (activeBadge) activeBadge.hidden = false;
            return;
        }

        setText("withdrawalStatusTitle", "Membership required");
        setText(
            "withdrawalStatusMessage",
            "Activate membership before requesting another withdrawal."
        );

        if (notice) notice.hidden = false;
        if (activeBadge) activeBadge.hidden = true;
    }

    async function loadUser() {
        try {
            const response = await fetch("/api/user-info/", {
                credentials: "same-origin",
                headers: { Accept: "application/json" },
            });

            if (!response.ok) return;

            const data = await response.json();
            const user = data.user || data;

            setText(
                "usernameDisplay",
                user.username || user.name || "User"
            );

            availableBalance = Number.parseFloat(
                user.balance ?? user.wallet_balance ?? 0
            ) || 0;

            setText("balanceAmount", money(availableBalance));
            updateMembershipState(user);

            const paypalEmail = byId("paypalEmail");
            if (paypalEmail && !paypalEmail.value && user.email) {
                paypalEmail.value = user.email;
            }
        } catch (error) {
            console.error("USER INFO ERROR:", error);
        }
    }

    function normaliseWithdrawal(item) {
        return {
            id: item.id,
            method: item.method || "Withdrawal",
            amount: Number.parseFloat(item.amount || 0) || 0,
            feePercentage: Number.parseFloat(
                item.fee_percentage ?? item.feePercent ?? 0
            ) || 0,
            feeAmount: Number.parseFloat(
                item.fee_amount ?? item.fee ?? 0
            ) || 0,
            netAmount: Number.parseFloat(
                item.net_amount ?? item.net ?? item.amount ?? 0
            ) || 0,
            status: String(item.status || "pending").toLowerCase(),
            createdAt:
                item.created_at ||
                item.created ||
                item.date ||
                "",
        };
    }

    function renderWithdrawals(status = "all") {
        const list = byId("withdrawHistoryList");
        if (!list) return;

        const filtered = status === "all"
            ? allWithdrawals
            : allWithdrawals.filter((item) => item.status === status);

        if (!filtered.length) {
            list.innerHTML = `
                <div class="empty-withdraw">
                    <i class="fa fa-receipt"></i>
                    <h3>No ${status === "all" ? "" : escapeHtml(status)} withdrawals</h3>
                    <p>Your withdrawal requests will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map((item) => `
            <article class="withdraw-history-item">
                <div>
                    <h3>${escapeHtml(item.method)}</h3>
                    <p>${escapeHtml(item.createdAt || "Date unavailable")}</p>
                    <p>
                        Fee ${escapeHtml(item.feePercentage)}%
                        · Net ${money(item.netAmount)}
                    </p>
                    <span class="status-badge ${escapeHtml(item.status)}">
                        ${escapeHtml(item.status)}
                    </span>
                </div>

                <div class="withdraw-history-amount">
                    <strong>${money(item.amount)}</strong>
                </div>
            </article>
        `).join("");
    }

    async function loadWithdrawals() {
        const list = byId("withdrawHistoryList");

        try {
            const response = await fetch("/api/withdrawal-history/", {
                credentials: "same-origin",
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            const data = await response.json();
            const records =
                data.withdrawals ||
                data.history ||
                data.results ||
                [];

            allWithdrawals = records.map(normaliseWithdrawal);

            const pendingTotal = Number.parseFloat(
                data.pending_total ?? data.pendingWithdrawals
            );

            const paidTotal = Number.parseFloat(
                data.paid_total ?? data.paidWithdrawals
            );

            const rejectedCount = Number.parseInt(
                data.rejected_count ?? data.rejectedWithdrawals,
                10
            );

            setText(
                "pendingWithdrawals",
                money(
                    Number.isFinite(pendingTotal)
                        ? pendingTotal
                        : allWithdrawals
                            .filter((item) => item.status === "pending")
                            .reduce((sum, item) => sum + item.amount, 0)
                )
            );

            setText(
                "paidWithdrawals",
                money(
                    Number.isFinite(paidTotal)
                        ? paidTotal
                        : allWithdrawals
                            .filter((item) => item.status === "paid")
                            .reduce((sum, item) => sum + item.netAmount, 0)
                )
            );

            setText(
                "rejectedWithdrawals",
                Number.isFinite(rejectedCount)
                    ? rejectedCount
                    : allWithdrawals.filter(
                        (item) => item.status === "rejected"
                    ).length
            );

            renderWithdrawals("all");
        } catch (error) {
            console.error("WITHDRAWAL HISTORY ERROR:", error);

            if (list) {
                list.innerHTML = `
                    <div class="empty-withdraw">
                        <i class="fa fa-triangle-exclamation"></i>
                        <h3>Unable to load withdrawals</h3>
                        <p>${escapeHtml(error.message)}</p>
                    </div>
                `;
            }
        }
    }

    async function submitPaypalWithdrawal(event) {
        event.preventDefault();

        const form = event.currentTarget;
        const message = form.querySelector(".withdraw-msg");
        const submitButton = form.querySelector(
            ".submit-withdrawal-btn"
        );

        const amount = Number.parseFloat(
            byId("paypalWithdrawalAmount")?.value || 0
        );

        const paypalEmail = byId("paypalEmail")?.value.trim() || "";

        if (!Number.isFinite(amount) || amount < MINIMUM_WITHDRAWAL) {
            message.textContent = "Minimum withdrawal amount is £10.";
            message.className = "withdraw-msg error";
            return;
        }

        if (amount > availableBalance) {
            message.textContent = "Your available balance is too low.";
            message.className = "withdraw-msg error";
            return;
        }

        if (!paypalEmail) {
            message.textContent = "Enter your PayPal email address.";
            message.className = "withdraw-msg error";
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
        message.textContent = "";
        message.className = "withdraw-msg";

        try {
            const formData = new FormData(form);

            const response = await fetch("/request-withdrawal/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                if (data.membership_required) {
                    const notice = byId("membershipRequiredNotice");
                    if (notice) notice.hidden = false;
                }

                throw new Error(
                    data.message ||
                    data.error ||
                    "Withdrawal request failed."
                );
            }

            message.textContent =
                data.message ||
                "Withdrawal request submitted successfully.";

            message.className = "withdraw-msg success";

            form.reset();
            calculatePaypalWithdrawal();

            await Promise.all([loadUser(), loadWithdrawals()]);

            window.setTimeout(() => {
                closeModal("paypalModal");
                message.textContent = "";
                message.className = "withdraw-msg";
            }, 1200);
        } catch (error) {
            console.error("WITHDRAWAL SUBMIT ERROR:", error);
            message.textContent = error.message;
            message.className = "withdraw-msg error";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Withdrawal";
        }
    }

    byId("openPaypalModal")?.addEventListener("click", () => {
        const message = byId("paypalWithdrawForm")?.querySelector(
            ".withdraw-msg"
        );

        if (message) {
            message.textContent = "";
            message.className = "withdraw-msg";
        }

        openModal("paypalModal");
    });

    document.querySelectorAll(".close-modal").forEach((button) => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

    document.querySelectorAll(".modal-overlay").forEach((modal) => {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        document.querySelectorAll(".modal-overlay.show").forEach(
            (modal) => closeModal(modal.id)
        );
    });

    byId("paypalWithdrawalAmount")?.addEventListener(
        "input",
        calculatePaypalWithdrawal
    );

    byId("paypalWithdrawForm")?.addEventListener(
        "submit",
        submitPaypalWithdrawal
    );

    byId("activateMembershipBtn")?.addEventListener("click", () => {
        window.location.href = "/pay-membership/";
    });

    byId("historyToggle")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const content = byId("historyContent");
        const expanded = button.getAttribute("aria-expanded") === "true";

        button.setAttribute("aria-expanded", String(!expanded));
        if (content) content.hidden = expanded;
    });

    document.querySelectorAll(".withdraw-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".withdraw-tab").forEach(
                (item) => item.classList.remove("active")
            );

            tab.classList.add("active");
            renderWithdrawals(tab.dataset.status || "all");
        });
    });

    loadUser();
    loadWithdrawals();
});
