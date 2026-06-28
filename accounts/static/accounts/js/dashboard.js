document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // UTILITIES
    // ==========================================================

    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }


    // ==========================================================
    // NAVIGATION ELEMENTS
    // ==========================================================

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileDropdown = document.getElementById("mobileDropdown");


    // ==========================================================
    // USER DETAILS / DASHBOARD DATA
    // ==========================================================

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (res.status === 401 || res.status === 403 || res.redirected) {
                window.location.href = "/login/";
                return;
            }

            if (!res.ok) {
                console.error("User info failed:", res.status);
                return;
            }

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", "@" + (data.username || "user"));
            setText("usernameDynamic", data.username || "User");

            setText("followers", data.followers || 0);
            setText("following", data.following || 0);

            setText("balanceAmount", money(data.balance));
            setText("earningsTotal", money(data.earnings));

            const membershipBanner = document.getElementById("membershipBanner");

            if (membershipBanner) {
                membershipBanner.style.display = data.is_member ? "none" : "flex";
            }

        } catch (err) {
            console.error("USER LOAD ERROR:", err);
        }
    }


    // ==========================================================
    // LOGOUT
    // ==========================================================

    async function logout(e) {
        if (e) e.preventDefault();

        try {
            await fetch("/api/logout/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                }
            });
        } catch (err) {
            console.error("Logout error:", err);
        }

        window.location.href = "/login/";
    }

    document.querySelectorAll(".logout").forEach((btn) => {
        btn.addEventListener("click", logout);
    });


    // ==========================================================
    // SEARCH BAR
    // ==========================================================

    const searchInput = document.getElementById("globalSearchInput");
    const searchResults = document.getElementById("searchResults");

    searchInput?.addEventListener("input", async () => {
        const query = searchInput.value.trim();

        if (!query) {
            searchResults.style.display = "none";
            searchResults.innerHTML = "";
            return;
        }

        try {
            const res = await fetch(`/api/search/?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            searchResults.innerHTML = "";

            if (!data.results.length) {
                searchResults.innerHTML = `
                    <div class="search-item">No results found</div>
                `;

                searchResults.style.display = "block";
                return;
            }

            data.results.forEach(item => {
                searchResults.innerHTML += `
                    <a href="${item.url}" class="search-item">
                        <strong>${item.name}</strong>
                        <div class="search-type">${item.type}</div>
                    </a>
                `;
            });

            searchResults.style.display = "block";

        } catch (err) {
            console.error("SEARCH ERROR:", err);
        }
    });


    // ==========================================================
    // NOTIFICATION MENU
    // ==========================================================

    const openNotifications = document.getElementById("openNotifications");
    const closeNotifications = document.getElementById("closeNotifications");
    const notificationOverlay = document.getElementById("notificationOverlay");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationList = document.getElementById("notificationList");
    const notificationCount = document.getElementById("notificationCount");

    async function loadNotifications() {
        if (!notificationList) return;

        notificationList.innerHTML = `
            <p class="empty-text">Loading notifications...</p>
        `;

        try {
            const response = await fetch("/api/notifications/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                notificationList.innerHTML = `
                    <p class="empty-text">Could not load notifications.</p>
                `;
                return;
            }

            const data = await response.json();

            if (notificationCount) {
                if (data.unread_count > 0) {
                    notificationCount.textContent = data.unread_count;
                    notificationCount.style.display = "inline-flex";
                } else {
                    notificationCount.style.display = "none";
                }
            }

            if (!data.notifications || data.notifications.length === 0) {
                notificationList.innerHTML = `
                    <p class="empty-text">No notifications yet.</p>
                `;
                return;
            }

            notificationList.innerHTML = data.notifications.map(notification => `
                <div class="notification-item ${notification.is_read ? "" : "unread"}">
                    <div class="notification-content">
                        <h4>${notification.title}</h4>
                        <p>${notification.message}</p>
                        <span class="notification-date">${notification.created_at}</span>
                    </div>
                </div>
            `).join("");

        } catch (error) {
            console.error("NOTIFICATION ERROR:", error);

            notificationList.innerHTML = `
                <p class="empty-text">Network error. Please try again.</p>
            `;
        }
    }

    function openNotificationPanel(e) {
        if (e) e.preventDefault();

        notificationOverlay?.classList.add("show");
        notificationPanel?.classList.add("show");
        mobileDropdown?.classList.remove("show");

        loadNotifications();
    }

    function closeNotificationPanel() {
        notificationOverlay?.classList.remove("show");
        notificationPanel?.classList.remove("show");
    }

    openNotifications?.addEventListener("click", openNotificationPanel);
    closeNotifications?.addEventListener("click", closeNotificationPanel);
    notificationOverlay?.addEventListener("click", closeNotificationPanel);


    // ==========================================================
    // FUND WALLET MODAL
    // ==========================================================

    const fundModal = document.getElementById("fundModal");
    const fundBtn = document.getElementById("fundBtn");
    const fundClose = document.getElementById("fundClose");
    const fundAmountInput = document.getElementById("fundAmountInput");
    const fundSubmitBtn = document.getElementById("fundSubmitBtn");
    const fundMsg = document.getElementById("fundMsg");

    function openFundModal() {
        if (!fundModal) return;

        if (fundMsg) fundMsg.textContent = "";
        if (fundAmountInput) fundAmountInput.value = "";

        fundModal.style.display = "flex";

        fundAmountInput?.focus();
    }

    function closeFundModal() {
        if (fundModal) fundModal.style.display = "none";
    }

    fundBtn?.addEventListener("click", openFundModal);
    fundClose?.addEventListener("click", closeFundModal);

    fundModal?.addEventListener("click", (e) => {
        if (e.target === fundModal) closeFundModal();
    });

    fundSubmitBtn?.addEventListener("click", async () => {
        const amount = fundAmountInput?.value;

        if (!amount || Number(amount) <= 0) {
            if (fundMsg) fundMsg.textContent = "Enter a valid amount.";
            return;
        }

        fundSubmitBtn.disabled = true;

        if (fundMsg) fundMsg.textContent = "Redirecting to Stripe...";

        try {
            const res = await fetch("/api/create-funding-checkout/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ amount })
            });

            const data = await res.json();

            if (!res.ok) {
                if (fundMsg) {
                    fundMsg.textContent = data.error || "Failed to start Stripe payment.";
                }
                return;
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
                return;
            }

            if (fundMsg) {
                fundMsg.textContent = "Stripe checkout URL was not returned.";
            }

        } catch (err) {
            console.error("FUND ERROR:", err);

            if (fundMsg) fundMsg.textContent = "Network error.";
        } finally {
            fundSubmitBtn.disabled = false;
        }
    });


    // ==========================================================
    // WITHDRAWAL MODAL
    // ==========================================================

    const withdrawModal = document.getElementById("withdrawModal");
    const withdrawBtn = document.getElementById("withdrawBtn");
    const withdrawClose = document.getElementById("withdrawClose");
    const withdrawAmountInput = document.getElementById("withdrawAmountInput");
    const sortCodeInput = document.getElementById("sortCodeInput");
    const accountNumberInput = document.getElementById("accountNumberInput");
    const withdrawSubmitBtn = document.getElementById("withdrawSubmitBtn");
    const withdrawMsg = document.getElementById("withdrawMsg");

    function openWithdrawModal() {
        if (!withdrawModal) return;

        if (withdrawMsg) withdrawMsg.textContent = "";
        if (withdrawAmountInput) withdrawAmountInput.value = "";
        if (sortCodeInput) sortCodeInput.value = "";
        if (accountNumberInput) accountNumberInput.value = "";

        withdrawModal.style.display = "flex";

        withdrawAmountInput?.focus();
    }

    function closeWithdrawModal() {
        if (withdrawModal) withdrawModal.style.display = "none";
    }

    withdrawBtn?.addEventListener("click", openWithdrawModal);
    withdrawClose?.addEventListener("click", closeWithdrawModal);

    withdrawModal?.addEventListener("click", (e) => {
        if (e.target === withdrawModal) closeWithdrawModal();
    });

    sortCodeInput?.addEventListener("input", () => {
        sortCodeInput.value = sortCodeInput.value.replace(/[^\d-]/g, "");
    });

    accountNumberInput?.addEventListener("input", () => {
        accountNumberInput.value = accountNumberInput.value.replace(/[^\d]/g, "");
    });

    withdrawSubmitBtn?.addEventListener("click", async () => {
        const amount = withdrawAmountInput?.value;
        const sort_code = sortCodeInput?.value;
        const account_number = accountNumberInput?.value;

        if (!amount || Number(amount) <= 0) {
            if (withdrawMsg) withdrawMsg.textContent = "Enter a valid amount.";
            return;
        }

        if (!sort_code || !account_number) {
            if (withdrawMsg) withdrawMsg.textContent = "Enter your bank details.";
            return;
        }

        withdrawSubmitBtn.disabled = true;

        if (withdrawMsg) withdrawMsg.textContent = "Processing...";

        try {
            const res = await fetch("/api/request-withdrawal/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount,
                    sort_code,
                    account_number
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (withdrawMsg) {
                    withdrawMsg.textContent = data.error || "Withdrawal failed.";
                }
                return;
            }

            setText("balanceAmount", money(data.new_balance));

            if (withdrawMsg) {
                withdrawMsg.textContent = data.message || "Withdrawal request submitted.";
            }

            loadUser();

            setTimeout(closeWithdrawModal, 700);

        } catch (err) {
            console.error("WITHDRAW ERROR:", err);

            if (withdrawMsg) {
                withdrawMsg.textContent = "Network error. Try again.";
            }
        } finally {
            withdrawSubmitBtn.disabled = false;
        }
    });


    // ==========================================================
    // TASK ACTION MODAL
    // ==========================================================

    const taskModal = document.getElementById("taskActionModal");
    const closeTaskModal = document.getElementById("taskActionClose");
    const modalTitle = document.getElementById("taskActionTitle");
    const modalPrice = document.getElementById("taskActionPrice");
    const modalDescription = document.getElementById("taskActionDescription");
    const modalIcon = document.getElementById("taskActionIcon");
    const quantityLabel = document.getElementById("quantityLabel");
    const platformGroup = document.getElementById("platformGroup");
    const quantityInput = document.getElementById("taskQuantity");
    const totalDisplay = document.getElementById("taskTotal");
    const taskLink = document.getElementById("taskLink");
    const taskPlatform = document.getElementById("taskPlatform");
    const submitTaskBtn = document.getElementById("submitTaskBtn");

    let currentPrice = 0;
    let taskType = null;

    document.querySelectorAll(".select-btn").forEach((button) => {
        button.addEventListener("click", function () {
            if (!taskModal) return;

            if (modalTitle) modalTitle.innerText = this.dataset.title || "";
            if (modalPrice) modalPrice.innerText = this.dataset.price || "";
            if (modalDescription) modalDescription.innerText = this.dataset.description || "";
            if (modalIcon) modalIcon.src = this.dataset.icon || "";

            currentPrice = parseFloat(this.dataset.amount) || 0;
            taskType = this.dataset.type || "";

            if (quantityInput) quantityInput.value = "";
            if (totalDisplay) totalDisplay.innerText = "£0.00";

            if (platformGroup) platformGroup.style.display = "block";

            if (taskType === "subscribe") {
                if (quantityLabel) quantityLabel.innerText = "Number of Subscribers You Want";
                if (platformGroup) platformGroup.style.display = "none";
                if (taskPlatform) taskPlatform.value = "YouTube";
                if (taskLink) taskLink.placeholder = "Enter your YouTube channel link";
            } else if (taskType === "like") {
                if (quantityLabel) quantityLabel.innerText = "Number of Likes You Want";
                if (taskLink) taskLink.placeholder = "Enter your post link";
            } else if (taskType === "comment") {
                if (quantityLabel) quantityLabel.innerText = "Number of Comments You Want";
                if (taskLink) taskLink.placeholder = "Enter your post link";
            } else {
                if (quantityLabel) quantityLabel.innerText = "Number of Followers You Want";
                if (taskLink) taskLink.placeholder = "Enter your page/profile link";
            }

            taskModal.style.display = "flex";
        });
    });

    quantityInput?.addEventListener("input", function () {
        const quantity = parseFloat(this.value);

        if (!isNaN(quantity) && quantity > 0) {
            if (totalDisplay) {
                totalDisplay.innerText = "£" + (quantity * currentPrice).toFixed(2);
            }
        } else {
            if (totalDisplay) {
                totalDisplay.innerText = "£0.00";
            }
        }
    });

    closeTaskModal?.addEventListener("click", () => {
        if (taskModal) taskModal.style.display = "none";
    });

    submitTaskBtn?.addEventListener("click", async () => {
        const quantity = parseInt(quantityInput?.value || "0");
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
            const res = await fetch("/create-task/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    platform,
                    followers: quantity,
                    link,
                    task_type: taskType
                })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Something went wrong.");
                return;
            }

            alert("Task created successfully.");

            setText("balanceAmount", money(data.new_balance));

            if (taskModal) {
                taskModal.style.display = "none";
            }

            loadUser();

        } catch (err) {
            console.error("TASK CREATE ERROR:", err);
            alert("Something went wrong. Check console.");
        } finally {
            submitTaskBtn.disabled = false;
        }
    });


    // ==========================================================
    // MEMBERSHIP ACTIVATION
    // ==========================================================

    const membershipBtn = document.getElementById("membershipBtn");

    membershipBtn?.addEventListener("click", async () => {
        membershipBtn.disabled = true;
        membershipBtn.textContent = "Activating...";

        try {
            const res = await fetch("/pay-membership/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Membership payment failed.");
                return;
            }

            alert(data.message || "Membership activated.");
            loadUser();

        } catch (err) {
            console.error("MEMBERSHIP ERROR:", err);
            alert("Something went wrong.");
        } finally {
            membershipBtn.disabled = false;
            membershipBtn.textContent = "Activate Membership";
        }
    });


   // ==========================================================
// MOBILE MENU
// ==========================================================

if (mobileMenuBtn && mobileDropdown) {
    mobileMenuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        mobileDropdown.classList.toggle("show");
    });

    mobileDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    document.addEventListener("click", (e) => {
        if (
            !mobileDropdown.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)
        ) {
            mobileDropdown.classList.remove("show");
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            mobileDropdown.classList.remove("show");
        }
    });
}


    // ==========================================================
    // CLOSE MODALS WHEN CLICKING OUTSIDE
    // ==========================================================

    window.addEventListener("click", (e) => {
        if (taskModal && e.target === taskModal) {
            taskModal.style.display = "none";
        }
    });


    // ==========================================================
    // INITIAL PAGE LOAD
    // ==========================================================

    loadUser();
    loadNotifications();

});