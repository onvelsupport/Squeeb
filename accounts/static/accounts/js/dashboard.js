document.addEventListener("DOMContentLoaded", () => {
    const byId = (id) => document.getElementById(id);
    const dashboardPage = byId("dashboardPage");

    const isNigerian = (
        dashboardPage?.dataset.nigeria === "true"
    );

    function getCookie(name) {
        let cookieValue = null;

        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");

            for (let cookie of cookies) {
                cookie = cookie.trim();

                if (cookie.startsWith(name + "=")) {
                    cookieValue = decodeURIComponent(
                        cookie.substring(name.length + 1)
                    );
                    break;
                }
            }
        }

        return cookieValue;
    }

    const money = (value) => {
        const amount = Number.parseFloat(value || 0);

        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
        }).format(Number.isFinite(amount) ? amount : 0);
    };

    const naira = (value) => {
        const amount = Number.parseFloat(value || 0);

        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2,
        }).format(Number.isFinite(amount) ? amount : 0);
    };

    function setText(id, value) {
        const element = byId(id);
        if (element) element.textContent = value;
    }

    const GBP_NGN_RATE_CACHE_KEY = "squeeb_gbp_ngn_rate";
    const GBP_NGN_RATE_CACHE_TIME_KEY = "squeeb_gbp_ngn_rate_updated_at";
    const GBP_NGN_RATE_CACHE_MS = 30 * 60 * 1000;

    async function refreshDashboardNairaEstimate(balanceOverride = null) {
        if (!isNigerian) return;

        const amountEl = byId("dashboardNairaAmount");
        const labelEl = byId("dashboardNairaLabel");
        if (!amountEl) return;

        let balance = Number.parseFloat(balanceOverride);
        if (!Number.isFinite(balance)) {
            const renderedBalance = Number.parseFloat(dashboardPage?.dataset.balance || "");
            if (Number.isFinite(renderedBalance)) balance = renderedBalance;
        }

        let cachedRate = Number.parseFloat(localStorage.getItem(GBP_NGN_RATE_CACHE_KEY) || "0") || 0;
        const cachedAt = Number.parseInt(localStorage.getItem(GBP_NGN_RATE_CACHE_TIME_KEY) || "0", 10) || 0;

        // Render the last known conversion immediately; never blank an existing estimate
        // while a fresh rate is being fetched.
        if (cachedRate > 0 && Number.isFinite(balance)) {
            amountEl.textContent = `≈ ${naira(balance * cachedRate)}`;
            if (labelEl) labelEl.textContent = `Estimated • £1 = ${naira(cachedRate)}`;
        }

        // Avoid another network request while the locally cached estimate is fresh.
        if (cachedRate > 0 && Date.now() - cachedAt < GBP_NGN_RATE_CACHE_MS) return;

        try {
            const response = await fetch("/api/exchange-rate/gbp-ngn/", {
                credentials: "same-origin",
                headers: { Accept: "application/json" },
            });
            const data = await parseJsonResponse(response);

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Unable to load exchange rate.");
            }

            const rate = Number.parseFloat(data.rate || 0) || 0;
            if (rate <= 0) throw new Error("Invalid exchange rate.");

            localStorage.setItem(GBP_NGN_RATE_CACHE_KEY, String(rate));
            localStorage.setItem(GBP_NGN_RATE_CACHE_TIME_KEY, String(Date.now()));

            if (!Number.isFinite(balance)) {
                const userResponse = await fetch("/api/user-info/", {
                    credentials: "same-origin",
                    headers: { Accept: "application/json" },
                });
                const userData = await parseJsonResponse(userResponse);
                balance = Number.parseFloat(userData.balance || 0) || 0;
            }

            amountEl.textContent = `≈ ${naira(balance * rate)}`;
            if (labelEl) labelEl.textContent = `Estimated • £1 = ${naira(rate)}`;
        } catch (error) {
            console.error("DASHBOARD NAIRA ESTIMATE ERROR:", error);
            if (cachedRate <= 0) {
                amountEl.textContent = "≈ ₦—";
                if (labelEl) labelEl.textContent = "Naira estimate unavailable";
            }
        }
    }

    async function parseJsonResponse(response) {
        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            return {};
        }

        try {
            return await response.json();
        } catch (error) {
            console.error("JSON PARSE ERROR:", error);
            return {};
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function openModal(modal) {
        if (!modal) return;
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.style.display = "none";

        const anyOpenModal = Array.from(
            document.querySelectorAll(".modal-bg")
        ).some((item) => item.style.display === "flex");

        if (!anyOpenModal) {
            document.body.style.overflow = "";
        }
    }

    // ==========================================================
    // USER SUMMARY
    // Initial values are server-rendered by Django.
    // Only refresh after an action changes the account.
    // ==========================================================

    async function refreshUserSummary() {
        try {
            const res = await fetch("/api/user-info/", {
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!res.ok) return;

            const data = await parseJsonResponse(res);

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", `@${data.username || "user"}`);
            setText("usernameDynamic", data.username || "User");
            setText("followers", data.followers || 0);
            setText("following", data.following || 0);
            setText("balanceAmount", money(data.balance));
            setText("earningsTotal", money(data.earnings));
            refreshDashboardNairaEstimate(data.balance);

            const membershipBanner = byId("membershipBanner");

            if (membershipBanner && data.is_member) {
                membershipBanner.remove();
            }
        } catch (error) {
            console.error("USER SUMMARY REFRESH ERROR:", error);
        }
    }

    refreshDashboardNairaEstimate();

    // ==========================================================
    // LOGOUT
    // ==========================================================

    async function logout(event) {
        event?.preventDefault();

        try {
            await fetch("/api/logout/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
            });
        } catch (error) {
            console.error("LOGOUT ERROR:", error);
        }

        window.location.href = "/login/";
    }

    document.querySelectorAll(".logout").forEach((button) => {
        button.addEventListener("click", logout);
    });

    // ==========================================================
    // SEARCH - DEBOUNCED
    // ==========================================================

    const searchInput = byId("globalSearchInput");
    const searchResults = byId("searchResults");
    let searchTimer = null;
    let activeSearchController = null;

    async function performSearch(query) {
        if (!searchResults) return;

        activeSearchController?.abort();
        activeSearchController = new AbortController();

        try {
            const response = await fetch(
                `/api/search/?q=${encodeURIComponent(query)}`,
                {
                    credentials: "same-origin",
                    signal: activeSearchController.signal,
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) return;

            searchResults.innerHTML = "";

            if (!data.results?.length) {
                searchResults.innerHTML = `
                    <div class="search-item">No results found</div>
                `;
                searchResults.style.display = "block";
                return;
            }

            searchResults.innerHTML = data.results.map((item) => `
                <a
                    href="${escapeHtml(item.url || "#")}"
                    class="search-item"
                >
                    <strong>${escapeHtml(item.name || "Result")}</strong>
                    <div class="search-type">
                        ${escapeHtml(item.type || "")}
                    </div>
                </a>
            `).join("");

            searchResults.style.display = "block";
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("SEARCH ERROR:", error);
            }
        }
    }

    searchInput?.addEventListener("input", () => {
        const query = searchInput.value.trim();
        clearTimeout(searchTimer);

        if (query.length < 2) {
            activeSearchController?.abort();

            if (searchResults) {
                searchResults.style.display = "none";
                searchResults.innerHTML = "";
            }
            return;
        }

        searchTimer = window.setTimeout(
            () => performSearch(query),
            300
        );
    });

    document.addEventListener("click", (event) => {
        if (
            searchInput &&
            searchResults &&
            !searchInput.contains(event.target) &&
            !searchResults.contains(event.target)
        ) {
            searchResults.style.display = "none";
        }
    });

    // ==========================================================
    // NOTIFICATIONS - LAZY LOAD ONLY WHEN OPENED
    // ==========================================================

    const openNotifications = byId("openNotifications");
    const closeNotifications = byId("closeNotifications");
    const notificationOverlay = byId("notificationOverlay");
    const notificationPanel = byId("notificationPanel");
    const notificationList = byId("notificationList");
    const notificationCount = byId("notificationCount");

    async function loadNotifications() {
        if (!notificationList) return;

        notificationList.innerHTML = `
            <p class="empty-text">Loading notifications...</p>
        `;

        try {
            const response = await fetch("/api/notifications/", {
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            });

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                throw new Error("Could not load notifications.");
            }

            if (!data.notifications?.length) {
                notificationList.innerHTML = `
                    <p class="empty-text">No notifications yet.</p>
                `;
                return;
            }

            notificationList.innerHTML = data.notifications.map(
                (notification) => `
                    <a
                        href="${escapeHtml(notification.link || "#")}"
                        class="notification-item ${
                            notification.is_read ? "" : "unread"
                        }"
                    >
                        <div class="notification-content">
                            <h4>${escapeHtml(notification.title || "Notification")}</h4>
                            <p>${escapeHtml(notification.message || "")}</p>
                            <span class="notification-date">
                                ${escapeHtml(notification.created_at || "")}
                            </span>
                        </div>
                    </a>
                `
            ).join("");
        } catch (error) {
            console.error("NOTIFICATION ERROR:", error);

            notificationList.innerHTML = `
                <p class="empty-text">
                    Could not load notifications.
                </p>
            `;
        }
    }

    async function markNotificationsRead() {
        try {
            await fetch("/api/notifications/read/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
            });

            if (notificationCount) {
                notificationCount.style.display = "none";
                notificationCount.textContent = "";
            }
        } catch (error) {
            console.error("MARK READ ERROR:", error);
        }
    }

    async function openNotificationPanel(event) {
        event?.preventDefault();

        notificationOverlay?.classList.add("show");
        notificationPanel?.classList.add("show");

        await loadNotifications();
        markNotificationsRead();
    }

    function closeNotificationPanel() {
        notificationOverlay?.classList.remove("show");
        notificationPanel?.classList.remove("show");
    }

    openNotifications?.addEventListener(
        "click",
        openNotificationPanel
    );

    closeNotifications?.addEventListener(
        "click",
        closeNotificationPanel
    );

    notificationOverlay?.addEventListener(
        "click",
        closeNotificationPanel
    );

    // ==========================================================
    // FUND WALLET
    // ==========================================================

    const fundModal = byId("fundModal");
    const fundBtn = byId("fundBtn");
    const fundClose = byId("fundClose");
    const fundAmountInput = byId("fundAmountInput");
    const fundSubmitBtn = byId("fundSubmitBtn");
    const fundMsg = byId("fundMsg");
    const fundMethods = document.querySelectorAll(".fund-method");
    const fundFee = byId("fundFee");
    const walletReceives = byId("walletReceives");
    const totalToPay = byId("totalToPay");
    const bankDetails = byId("bankDetails");
    const bankReference = byId("bankReference");
    const fundExchangeRate = byId("fundExchangeRate");

    let selectedFundingMethod = (
        isNigerian ? "nigeria" : "card"
    );

    let currentGbpNgnRate = 0;
    let exchangeRatePromise = null;

    function generateBankReference() {
        if (bankReference) {
            bankReference.textContent = (
                `SQB-${Date.now().toString().slice(-6)}`
            );
        }
    }

    function updateFundingSummary() {
        const amount = Number.parseFloat(
            fundAmountInput?.value || 0
        ) || 0;

        if (walletReceives) {
            walletReceives.textContent = money(amount);
        }

        if (isNigerian) {
            const ngnAmount = amount * currentGbpNgnRate;

            if (totalToPay) {
                totalToPay.textContent = naira(ngnAmount);
            }
            return;
        }

        let fee = 0;
        let total = amount;

        if (selectedFundingMethod === "card") {
            fee = amount > 0
                ? (amount * 0.02) + 0.25
                : 0;

            total = amount + fee;

            if (bankDetails) {
                bankDetails.style.display = "none";
            }

            if (fundSubmitBtn) {
                fundSubmitBtn.textContent = "Continue to Payment";
            }
        } else {
            if (bankDetails) {
                bankDetails.style.display = "block";
            }

            if (fundSubmitBtn) {
                fundSubmitBtn.textContent = "I've Sent the Transfer";
            }
        }

        if (fundFee) {
            fundFee.textContent = money(fee);
        }

        if (totalToPay) {
            totalToPay.textContent = money(total);
        }
    }

    async function loadFundingExchangeRate() {
        if (!isNigerian) return 0;

        if (currentGbpNgnRate > 0) {
            return currentGbpNgnRate;
        }

        if (exchangeRatePromise) {
            return exchangeRatePromise;
        }

        if (fundExchangeRate) {
            fundExchangeRate.textContent = "Loading...";
        }

        exchangeRatePromise = (async () => {
            try {
                const response = await fetch(
                    "/api/exchange-rate/gbp-ngn/",
                    {
                        credentials: "same-origin",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                const data = await parseJsonResponse(response);

                if (!response.ok || data.success === false) {
                    throw new Error(
                        data.message ||
                        "Unable to load the exchange rate."
                    );
                }

                currentGbpNgnRate = Number.parseFloat(
                    data.rate || 0
                ) || 0;

                if (fundExchangeRate) {
                    fundExchangeRate.textContent = (
                        `£1 = ${naira(currentGbpNgnRate)}`
                    );
                }

                updateFundingSummary();
                return currentGbpNgnRate;
            } catch (error) {
                console.error("FUND RATE ERROR:", error);

                if (fundExchangeRate) {
                    fundExchangeRate.textContent = "Unavailable";
                }

                if (fundMsg) {
                    fundMsg.textContent = error.message;
                }

                return 0;
            } finally {
                exchangeRatePromise = null;
            }
        })();

        return exchangeRatePromise;
    }

    async function openFundModal() {
        if (!fundModal) return;

        if (fundMsg) fundMsg.textContent = "";
        if (fundAmountInput) fundAmountInput.value = "";

        selectedFundingMethod = (
            isNigerian ? "nigeria" : "card"
        );

        fundMethods.forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.method === selectedFundingMethod
            );
        });

        updateFundingSummary();
        openModal(fundModal);
        fundAmountInput?.focus();

        // Important: only call FX API when a Nigerian user opens
        // the funding modal, not during initial page load.
        if (isNigerian) {
            await loadFundingExchangeRate();
        }
    }

    fundMethods.forEach((button) => {
        button.addEventListener("click", () => {
            selectedFundingMethod = button.dataset.method;

            fundMethods.forEach(
                (item) => item.classList.remove("active")
            );

            button.classList.add("active");

            if (selectedFundingMethod === "bank") {
                generateBankReference();
            }

            if (fundMsg) fundMsg.textContent = "";
            updateFundingSummary();
        });
    });

    fundAmountInput?.addEventListener(
        "input",
        updateFundingSummary
    );

    fundBtn?.addEventListener("click", openFundModal);
    fundClose?.addEventListener(
        "click",
        () => closeModal(fundModal)
    );

    fundModal?.addEventListener("click", (event) => {
        if (event.target === fundModal) {
            closeModal(fundModal);
        }
    });

    fundSubmitBtn?.addEventListener("click", async () => {
        const amount = Number.parseFloat(
            fundAmountInput?.value || 0
        );

        if (!Number.isFinite(amount) || amount < 1) {
            if (fundMsg) {
                fundMsg.textContent = (
                    "Minimum funding amount is £1.00."
                );
            }
            return;
        }

        if (isNigerian && !currentGbpNgnRate) {
            const rate = await loadFundingExchangeRate();

            if (!rate) {
                return;
            }
        }

        fundSubmitBtn.disabled = true;

        if (fundMsg) {
            fundMsg.textContent = isNigerian
                ? "Creating secure Naira checkout..."
                : (
                    selectedFundingMethod === "card"
                        ? "Redirecting to payment..."
                        : "Creating bank transfer request..."
                );
        }

        try {
            const response = await fetch(
                "/api/create-funding-checkout/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: JSON.stringify({
                        amount: amount.toFixed(2),
                        method: selectedFundingMethod,
                        reference: (
                            bankReference?.textContent || ""
                        ),
                    }),
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Failed to start funding request."
                );
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
                return;
            }

            if (selectedFundingMethod === "bank") {
                if (fundMsg) {
                    fundMsg.textContent = (
                        data.message ||
                        "Transfer request created."
                    );
                }
                return;
            }

            if (fundMsg) {
                fundMsg.textContent = (
                    "Payment URL was not returned."
                );
            }
        } catch (error) {
            console.error("FUND ERROR:", error);

            if (fundMsg) {
                fundMsg.textContent = error.message;
            }
        } finally {
            fundSubmitBtn.disabled = false;
        }
    });

    // ==========================================================
    // LEGACY WITHDRAWAL MODAL ON DASHBOARD
    // ==========================================================

    const withdrawModal = byId("withdrawModal");
    const withdrawBtn = byId("withdrawBtn");
    const withdrawClose = byId("withdrawClose");
    const withdrawAmountInput = byId("withdrawAmountInput");
    const sortCodeInput = byId("sortCodeInput");
    const accountNumberInput = byId("accountNumberInput");
    const withdrawSubmitBtn = byId("withdrawSubmitBtn");
    const withdrawMsg = byId("withdrawMsg");

    withdrawBtn?.addEventListener(
        "click",
        () => openModal(withdrawModal)
    );

    withdrawClose?.addEventListener(
        "click",
        () => closeModal(withdrawModal)
    );

    sortCodeInput?.addEventListener("input", () => {
        sortCodeInput.value = sortCodeInput.value.replace(
            /[^\d-]/g,
            ""
        );
    });

    accountNumberInput?.addEventListener("input", () => {
        accountNumberInput.value = (
            accountNumberInput.value.replace(/[^\d]/g, "")
        );
    });

    withdrawSubmitBtn?.addEventListener("click", async () => {
        const amount = withdrawAmountInput?.value;
        const sortCode = sortCodeInput?.value;
        const accountNumber = accountNumberInput?.value;

        if (!amount || Number(amount) <= 0) {
            if (withdrawMsg) {
                withdrawMsg.textContent = "Enter a valid amount.";
            }
            return;
        }

        if (!sortCode || !accountNumber) {
            if (withdrawMsg) {
                withdrawMsg.textContent = "Enter your bank details.";
            }
            return;
        }

        withdrawSubmitBtn.disabled = true;

        try {
            const response = await fetch(
                "/api/request-withdrawal/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: JSON.stringify({
                        amount,
                        sort_code: sortCode,
                        account_number: accountNumber,
                    }),
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                throw new Error(
                    data.error || "Withdrawal failed."
                );
            }

            await refreshUserSummary();

            if (withdrawMsg) {
                withdrawMsg.textContent = (
                    data.message ||
                    "Withdrawal request submitted."
                );
            }

            window.setTimeout(
                () => closeModal(withdrawModal),
                700
            );
        } catch (error) {
            if (withdrawMsg) {
                withdrawMsg.textContent = error.message;
            }
        } finally {
            withdrawSubmitBtn.disabled = false;
        }
    });

    // ==========================================================
    // TASK ACTION MODAL
    // ==========================================================

    const taskModal = byId("taskActionModal");
    const taskActionClose = byId("taskActionClose");
    const modalTitle = byId("taskActionTitle");
    const modalPrice = byId("taskActionPrice");
    const modalDescription = byId("taskActionDescription");
    const modalIcon = byId("taskActionIcon");
    const quantityLabel = byId("quantityLabel");
    const platformGroup = byId("platformGroup");
    const quantityInput = byId("taskQuantity");
    const totalDisplay = byId("taskTotal");
    const taskLink = byId("taskLink");
    const taskPlatform = byId("taskPlatform");
    const submitTaskBtn = byId("submitTaskBtn");

    let currentPrice = 0;
    let taskType = "";

    document.querySelectorAll(".select-btn").forEach((button) => {
        button.addEventListener("click", function () {
            currentPrice = Number.parseFloat(
                this.dataset.amount || 0
            ) || 0;

            taskType = this.dataset.type || "";

            if (modalTitle) {
                modalTitle.textContent = this.dataset.title || "";
            }

            if (modalPrice) {
                modalPrice.textContent = this.dataset.price || "";
            }

            if (modalDescription) {
                modalDescription.textContent = (
                    this.dataset.description || ""
                );
            }

            if (modalIcon) {
                modalIcon.src = this.dataset.icon || "";
            }

            if (quantityInput) quantityInput.value = "";
            if (totalDisplay) totalDisplay.textContent = "£0.00";
            if (taskLink) taskLink.value = "";

            if (platformGroup) {
                platformGroup.style.display = (
                    taskType === "subscribe"
                        ? "none"
                        : "block"
                );
            }

            if (taskType === "subscribe") {
                if (quantityLabel) {
                    quantityLabel.textContent = (
                        "Number of Subscribers You Want"
                    );
                }
                if (taskPlatform) taskPlatform.value = "YouTube";
                if (taskLink) {
                    taskLink.placeholder = (
                        "Enter your YouTube channel link"
                    );
                }
            } else {
                const labels = {
                    follow: "Number of Followers You Want",
                    like: "Number of Likes You Want",
                    comment: "Number of Comments You Want",
                    repost: "Number of Reposts You Want",
                };

                if (quantityLabel) {
                    quantityLabel.textContent = (
                        labels[taskType] || "Quantity"
                    );
                }

                if (taskPlatform) taskPlatform.value = "";

                if (taskLink) {
                    taskLink.placeholder = (
                        taskType === "follow"
                            ? "Enter your page/profile link"
                            : "Enter your post link"
                    );
                }
            }

            openModal(taskModal);
        });
    });

    quantityInput?.addEventListener("input", function () {
        const quantity = Number.parseFloat(this.value);

        if (totalDisplay) {
            totalDisplay.textContent = (
                Number.isFinite(quantity) && quantity > 0
                    ? money(quantity * currentPrice)
                    : "£0.00"
            );
        }
    });

    taskActionClose?.addEventListener(
        "click",
        () => closeModal(taskModal)
    );

    submitTaskBtn?.addEventListener("click", async () => {
        const quantity = Number.parseInt(
            quantityInput?.value || "0",
            10
        );

        const link = taskLink?.value.trim() || "";
        const platform = taskPlatform?.value || "";

        if (taskType !== "subscribe" && !platform) {
            alert("Please select a platform.");
            return;
        }

        if (!quantity || quantity <= 0) {
            alert("Enter a valid quantity.");
            return;
        }

        if (!link) {
            alert("Enter your link.");
            return;
        }

        submitTaskBtn.disabled = true;

        try {
            const response = await fetch("/create-task/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({
                    platform,
                    followers: quantity,
                    link,
                    task_type: taskType,
                }),
            });

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                alert(data.error || "Something went wrong.");
                return;
            }

            alert("Task created successfully.");
            closeModal(taskModal);
            await refreshUserSummary();
        } catch (error) {
            console.error("TASK CREATE ERROR:", error);
            alert("Something went wrong.");
        } finally {
            submitTaskBtn.disabled = false;
        }
    });

    // ==========================================================
    // ADMIN CAMPAIGN MODAL
    // ==========================================================

    const campaignModal = byId("campaignModal");
    const openCampaignBtn = byId("openCampaignModal");
    const campaignClose = byId("campaignClose");
    const createCampaignBtn = byId("createCampaignBtn");

    const campaignTitle = byId("campaignTitle");
    const campaignDescription = byId("campaignDescription");
    const campaignReward = byId("campaignReward");
    const campaignPlatform = byId("campaignPlatform");
    const campaignParticipants = byId("campaignParticipants");
    const campaignStartDate = byId("campaignStartDate");
    const campaignEndDate = byId("campaignEndDate");
    const campaignStatus = byId("campaignStatus");
    const campaignImage = byId("campaignImage");
    const campaignBudget = byId("campaignBudget");

    function updateCampaignBudget() {
        const reward = Number.parseFloat(
            campaignReward?.value || 0
        ) || 0;

        const participants = Number.parseInt(
            campaignParticipants?.value || "0",
            10
        ) || 0;

        if (campaignBudget) {
            campaignBudget.textContent = money(
                reward * participants
            );
        }
    }

    campaignReward?.addEventListener(
        "input",
        updateCampaignBudget
    );

    campaignParticipants?.addEventListener(
        "input",
        updateCampaignBudget
    );

    openCampaignBtn?.addEventListener(
        "click",
        () => openModal(campaignModal)
    );

    campaignClose?.addEventListener(
        "click",
        () => closeModal(campaignModal)
    );

    createCampaignBtn?.addEventListener("click", async () => {
        const form = new FormData();

        form.append(
            "title",
            campaignTitle?.value.trim() || ""
        );

        form.append(
            "description",
            campaignDescription?.value.trim() || ""
        );

        form.append(
            "reward",
            campaignReward?.value || ""
        );

        form.append(
            "platform",
            campaignPlatform?.value || ""
        );

        form.append(
            "max_participants",
            campaignParticipants?.value || ""
        );

        form.append(
            "start_date",
            campaignStartDate?.value || ""
        );

        form.append(
            "end_date",
            campaignEndDate?.value || ""
        );

        form.append(
            "status",
            campaignStatus?.value || "draft"
        );

        if (campaignImage?.files?.length) {
            form.append(
                "image",
                campaignImage.files[0]
            );
        }

        createCampaignBtn.disabled = true;
        createCampaignBtn.textContent = "Creating...";

        try {
            const response = await fetch(
                "/api/admin/create-campaign/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: form,
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                alert(
                    data.error ||
                    "Unable to create campaign."
                );
                return;
            }

            alert("Campaign created successfully!");
            closeModal(campaignModal);
        } catch (error) {
            console.error("CAMPAIGN ERROR:", error);
            alert("Network error.");
        } finally {
            createCampaignBtn.disabled = false;
            createCampaignBtn.textContent = "Create Campaign";
        }
    });

    // ==========================================================
    // MEMBERSHIP
    // ==========================================================

    const membershipBtn = (
        byId("activateMembershipBtn") ||
        byId("membershipBtn")
    );

    membershipBtn?.addEventListener("click", async (event) => {
        if (membershipBtn.tagName === "A") {
            return;
        }

        event.preventDefault();
        membershipBtn.disabled = true;
        membershipBtn.textContent = "Activating...";

        try {
            const response = await fetch(
                "/pay-membership/",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                }
            );

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                alert(
                    data.error ||
                    "Membership payment failed."
                );
                return;
            }

            alert(
                data.message ||
                "Membership activated."
            );

            await refreshUserSummary();
        } catch (error) {
            console.error("MEMBERSHIP ERROR:", error);
            alert("Something went wrong.");
        } finally {
            membershipBtn.disabled = false;
            membershipBtn.textContent = "Activate Membership";
        }
    });

    // ==========================================================
    // MOBILE MENU / TASK EXPANSION
    // ==========================================================

    const mobileMenuBtn = byId("mobileMenuBtn");
    const mobileDropdown = byId("mobileDropdown");

    if (mobileMenuBtn && mobileDropdown) {
        mobileMenuBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            mobileDropdown.classList.toggle("show");
        });

        mobileDropdown.addEventListener(
            "click",
            (event) => event.stopPropagation()
        );

        document.addEventListener("click", (event) => {
            if (
                !mobileDropdown.contains(event.target) &&
                !mobileMenuBtn.contains(event.target)
            ) {
                mobileDropdown.classList.remove("show");
            }
        });
    }

    const tasksSection = document.querySelector(
        ".tasks-section"
    );

    const mobileTaskToggle = byId("mobileTaskToggle");

    mobileTaskToggle?.addEventListener("click", () => {
        if (!tasksSection) return;

        const expanded = tasksSection.classList.toggle(
            "mobile-expanded"
        );

        mobileTaskToggle.setAttribute(
            "aria-expanded",
            String(expanded)
        );

        const label = mobileTaskToggle.querySelector("span");

        if (label) {
            label.textContent = expanded
                ? "Show fewer social tasks"
                : "View all social tasks";
        }
    });

    // ==========================================================
    // GLOBAL MODAL CLOSING
    // ==========================================================

    window.addEventListener("click", (event) => {
        [
            fundModal,
            withdrawModal,
            taskModal,
            campaignModal,
        ].forEach((modal) => {
            if (modal && event.target === modal) {
                closeModal(modal);
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        closeNotificationPanel();
        closeModal(fundModal);
        closeModal(withdrawModal);
        closeModal(taskModal);
        closeModal(campaignModal);
        mobileDropdown?.classList.remove("show");
    });

    // No loadUser() and no loadNotifications() here.
    // The dashboard arrives already populated by Django.
});
