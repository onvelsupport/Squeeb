document.addEventListener("DOMContentLoaded", () => {
    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    const withdrawalMessage = document.getElementById("withdrawalMessage");
    const withdrawalFee = document.getElementById("withdrawalFee");

    const activateMembershipBtn = document.getElementById(
        "activateMembershipBtn"
    );

    const membershipActiveBadge = document.getElementById(
        "membershipActiveBadge"
    );

    const taskModal = document.getElementById("taskModal");
    const cancelTaskBtn = document.getElementById("cancelTaskBtn");
    const submitProofBtn = document.getElementById("submitProofBtn");

    const submissionList = document.getElementById("submissionList");
    const submissionTabs = document.querySelectorAll(".submission-tab");

    let selectedTaskId = null;
    let selectedTaskType = "task";

    let allSubmissions = [];
    let activeSubmissionFilter = "all";

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function statusLabel(status) {
        if (status === "approved") {
            return "Approved";
        }

        if (status === "rejected") {
            return "Rejected";
        }

        return "Pending";
    }

    function statusIcon(status) {
        if (status === "approved") {
            return "fa-circle-check";
        }

        if (status === "rejected") {
            return "fa-circle-xmark";
        }

        return "fa-clock";
    }

    function escapeHtml(value) {
        const div = document.createElement("div");

        div.textContent = value || "";

        return div.innerHTML;
    }


    function getCookie(name) {
        let cookieValue = null;

        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");

            for (let cookie of cookies) {
                cookie = cookie.trim();

                if (cookie.startsWith(`${name}=`)) {
                    cookieValue = decodeURIComponent(
                        cookie.substring(name.length + 1)
                    );

                    break;
                }
            }
        }

        return cookieValue;
    }

    function normaliseBoolean(value) {
        return (
            value === true ||
            value === 1 ||
            String(value).toLowerCase() === "true" ||
            String(value) === "1"
        );
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

    function openTaskModal() {
        if (!taskModal) return;

        taskModal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

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

            const user = await parseJsonResponse(response);

            setText(
                "usernameDisplay",
                user.username || "User"
            );

            setText(
                "usernameTag",
                `@${user.username || "user"}`
            );

            setText(
                "balanceAmount",
                money(user.balance)
            );

            setText(
                "earningsTotal",
                money(user.earnings)
            );

            setText(
                "tasksCompleted",
                user.tasks_completed || 0
            );

            setText(
                "referrals",
                user.referrals || 0
            );

            /*
             * Tasks are available to every user.
             * Membership is only required after the first
             * successful withdrawal.
             */
            loadTasks();

            updateWithdrawalPanel(user);

        } catch (error) {
            console.error(
                "USER LOAD ERROR:",
                error
            );
        }
    }

    // ==========================================================
    // WITHDRAWAL AND MEMBERSHIP PANEL
    // ==========================================================

    function updateWithdrawalPanel(user) {
        const rawMembershipValue =
            user.is_member ??
            user.membership_active ??
            user.has_membership ??
            user.is_active_member ??
            false;

        const isMember = normaliseBoolean(rawMembershipValue);
        const firstWithdrawalCompleted = normaliseBoolean(
            user.first_withdrawal_completed
        );

        /*
         * Active membership must take priority, even when the
         * first-withdrawal field is missing or returned as a string.
         */
        if (isMember) {
            if (withdrawalMessage) {
                withdrawalMessage.textContent =
                    "Membership is active. All future withdrawals " +
                    "will have a reduced 10% fee.";
            }

            if (withdrawalFee) {
                withdrawalFee.textContent = "10%";
            }

            if (activateMembershipBtn) {
                activateMembershipBtn.hidden = true;
                activateMembershipBtn.style.display = "none";
            }

            if (membershipActiveBadge) {
                membershipActiveBadge.hidden = false;
                membershipActiveBadge.style.display = "flex";
            }

            return;
        }

        /*
         * Before the first successful withdrawal:
         * - No membership required
         * - 20% withdrawal fee
         */
        if (!firstWithdrawalCompleted) {
            if (withdrawalMessage) {
                withdrawalMessage.textContent =
                    "Your first withdrawal is available without " +
                    "membership. A 20% withdrawal fee will apply.";
            }

            if (withdrawalFee) {
                withdrawalFee.textContent = "20%";
            }

            if (activateMembershipBtn) {
                activateMembershipBtn.hidden = true;
                activateMembershipBtn.style.display = "none";
            }

            if (membershipActiveBadge) {
                membershipActiveBadge.hidden = true;
                membershipActiveBadge.style.display = "none";
            }

            return;
        }

        /*
         * After the first withdrawal, users without membership
         * are shown the activation button.
         */
        if (withdrawalMessage) {
            withdrawalMessage.textContent =
                "Your first withdrawal has been completed. " +
                "Activate SQUEEB Membership before requesting " +
                "another withdrawal.";
        }

        if (withdrawalFee) {
            withdrawalFee.textContent = "10%";
        }

        if (activateMembershipBtn) {
            activateMembershipBtn.hidden = false;
            activateMembershipBtn.style.display = "block";
        }

        if (membershipActiveBadge) {
            membershipActiveBadge.hidden = true;
            membershipActiveBadge.style.display = "none";
        }
    }

    // ==========================================================
    // AVAILABLE TASKS AND CAMPAIGNS
    // ==========================================================

    async function loadTasks() {
        const taskList = document.getElementById("taskList");

        if (!taskList) {
            return;
        }

        taskList.innerHTML = `
            <div class="empty-task">
                <i class="fa fa-spinner fa-spin"></i>

                <h3>Loading opportunities</h3>

                <p>
                    Please wait while we load available tasks.
                </p>
            </div>
        `;

        try {
            const response = await fetch("/api/tasks/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-circle-exclamation"></i>

                        <h3>Unable to load tasks</h3>

                        <p>
                            ${escapeHtml(
                                data.error ||
                                "Please try again."
                            )}
                        </p>
                    </div>
                `;

                return;
            }

            taskList.innerHTML = "";

            if (
                !data.tasks ||
                data.tasks.length === 0
            ) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-list-check"></i>

                        <h3>No tasks available</h3>

                        <p>
                            New earning tasks will appear here
                            when available.
                        </p>
                    </div>
                `;

                return;
            }

            data.tasks.forEach((task) => {
                const isCampaign = task.featured === true;

                const platform = escapeHtml(
                    task.platforms || "Task"
                );

                const title = escapeHtml(
                    task.title || "Untitled Task"
                );

                const description = escapeHtml(
                    task.short_desc ||
                    task.instructions ||
                    "Complete this task and upload proof."
                );

                taskList.innerHTML += `
                    <div class="
                        earn-task-card
                        ${isCampaign ? "featured-campaign" : ""}
                    ">
                        <div>
                            <span class="task-badge">
                                ${
                                    isCampaign
                                        ? `
                                            <i class="fa fa-fire"></i>
                                            SQUEEB Campaign
                                        `
                                        : platform
                                }
                            </span>

                            <h3>${title}</h3>

                            <p>${description}</p>

                            <strong class="task-reward">
                                ${
                                    isCampaign
                                        ? `${money(task.payout)} reward`
                                        : `
                                            ${money(task.payout)}
                                            per
                                            ${escapeHtml(
                                                task.task_type ||
                                                "task"
                                            )}
                                        `
                                }
                            </strong>

                            ${
                                isCampaign
                                    ? `
                                        <span class="campaign-slots">
                                            ${parseInt(
                                                task.available || 0,
                                                10
                                            )}
                                            slots remaining
                                        </span>
                                    `
                                    : ""
                            }
                        </div>

                        <button
                            type="button"
                            class="select-task-btn"
                            data-id="${task.id}"
                            data-featured="${isCampaign}"
                        >
                            ${
                                isCampaign
                                    ? "Participate"
                                    : "Select Task"
                            }
                        </button>
                    </div>
                `;
            });

        } catch (error) {
            console.error(
                "TASK LOAD ERROR:",
                error
            );

            taskList.innerHTML = `
                <div class="empty-task">
                    <i class="fa fa-wifi"></i>

                    <h3>Network error</h3>

                    <p>
                        Please check your connection and try again.
                    </p>
                </div>
            `;
        }
    }

    // ==========================================================
    // OPEN TASK OR CAMPAIGN MODAL
    // ==========================================================

    document.addEventListener("click", async (event) => {
        const button = event.target.closest(".select-task-btn");

        if (!button) {
            return;
        }

        selectedTaskId = button.dataset.id;

        selectedTaskType =
            button.dataset.featured === "true"
                ? "campaign"
                : "task";

        const endpoint =
            selectedTaskType === "campaign"
                ? `/api/campaign/${selectedTaskId}/`
                : `/api/task/${selectedTaskId}/`;

        button.disabled = true;

        const originalButtonText = button.textContent;

        button.textContent = "Loading...";

        try {
            const response = await fetch(endpoint, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                alert(
                    data.error ||
                    "Unable to open this opportunity."
                );

                return;
            }

            setText(
                "modalTaskTitle",
                data.title || "Task"
            );

            setText(
                "modalPlatform",
                data.platform || ""
            );

            setText(
                "modalType",
                data.task_type || ""
            );

            setText(
                "modalTaskReward",
                `Earn ${money(data.payout)}`
            );

            const instructionsBox = document.getElementById(
                "modalTaskInstructions"
            );

            if (instructionsBox) {
                if (Array.isArray(data.instructions)) {
                    instructionsBox.innerHTML = `
                        <ul>
                            ${data.instructions
                                .map(
                                    (step) => `
                                        <li>
                                            ${escapeHtml(step)}
                                        </li>
                                    `
                                )
                                .join("")}
                        </ul>
                    `;
                } else {
                    instructionsBox.innerHTML = `
                        <ul>
                            <li>
                                ${escapeHtml(
                                    data.instructions ||
                                    "Complete the task and upload proof."
                                )}
                            </li>
                        </ul>
                    `;
                }
            }

            const taskLink = document.getElementById(
                "modalTaskLink"
            );

            if (taskLink) {
                if (data.link) {
                    taskLink.href = data.link;
                    taskLink.style.display = "inline-flex";
                } else {
                    taskLink.removeAttribute("href");
                    taskLink.style.display = "none";
                }
            }

            const campaignVideoGroup = document.getElementById(
                "campaignVideoGroup"
            );

            const campaignVideoLink = document.getElementById(
                "campaignVideoLink"
            );

            if (campaignVideoGroup) {
                campaignVideoGroup.style.display =
                    selectedTaskType === "campaign"
                        ? "block"
                        : "none";
            }

            if (campaignVideoLink) {
                campaignVideoLink.value = "";
            }

            const proofInput = document.getElementById(
                "proofInput"
            );

            if (proofInput) {
                proofInput.value = "";
            }

            if (submitProofBtn) {
                submitProofBtn.textContent =
                    selectedTaskType === "campaign"
                        ? "Submit Campaign Proof"
                        : "Submit Proof";
            }

            if (taskModal) {
                openTaskModal();
            }

        } catch (error) {
            console.error(
                "OPPORTUNITY LOAD ERROR:",
                error
            );

            alert(
                "Network error. Please try again."
            );

        } finally {
            button.disabled = false;
            button.textContent = originalButtonText;
        }
    });

    // ==========================================================
    // SUBMIT TASK OR CAMPAIGN PROOF
    // ==========================================================

    submitProofBtn?.addEventListener("click", async () => {
        const proofInput = document.getElementById(
            "proofInput"
        );

        const proofFile = proofInput?.files[0];

        if (!selectedTaskId) {
            alert(
                "No task or campaign selected."
            );

            return;
        }

        if (!proofFile) {
            alert(
                "Please upload screenshot proof."
            );

            return;
        }

        const formData = new FormData();

        formData.append(
            "proof",
            proofFile
        );

        if (selectedTaskType === "campaign") {
            const campaignVideoLink = document
                .getElementById("campaignVideoLink")
                ?.value.trim();

            if (!campaignVideoLink) {
                alert(
                    "Please enter your published social media video link."
                );

                return;
            }

            formData.append(
                "video_link",
                campaignVideoLink
            );
        }

        const endpoint =
            selectedTaskType === "campaign"
                ? `/api/campaign/${selectedTaskId}/submit/`
                : `/api/complete-task/${selectedTaskId}/`;

        submitProofBtn.disabled = true;
        submitProofBtn.textContent = "Submitting...";

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken")
                },
                body: formData
            });

            const data = await parseJsonResponse(response);

            if (!response.ok) {
                alert(
                    data.error ||
                    data.message ||
                    "Proof submission failed."
                );

                return;
            }

            alert(
                data.message ||
                "Your submission has been sent for review."
            );

            if (taskModal) {
                taskModal.style.display = "none";
            }

            selectedTaskId = null;
            selectedTaskType = "task";

            await loadUser();
            await loadSubmissions();
            await loadRecentActivities();

        } catch (error) {
            console.error(
                "PROOF SUBMIT ERROR:",
                error
            );

            alert(
                "Network error. Please try again."
            );

        } finally {
            submitProofBtn.disabled = false;
            submitProofBtn.textContent = "Submit Proof";
        }
    });

    // ==========================================================
    // USER SUBMISSIONS
    // ==========================================================

    async function loadSubmissions() {
        if (!submissionList) {
            return;
        }

        try {
            const response = await fetch(
                "/api/my-task-submissions/",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                return;
            }

            const data = await parseJsonResponse(response);

            allSubmissions = data.submissions || [];

            renderSubmissions();

        } catch (error) {
            console.error(
                "SUBMISSIONS LOAD ERROR:",
                error
            );
        }
    }

    function renderSubmissions() {
        if (!submissionList) {
            return;
        }

        let submissions = allSubmissions;

        if (activeSubmissionFilter !== "all") {
            submissions = allSubmissions.filter(
                (item) =>
                    item.status === activeSubmissionFilter
            );
        }

        if (!submissions.length) {
            submissionList.innerHTML = `
                <div class="empty-task">
                    <i class="fa fa-clock"></i>

                    <h3>
                        No ${
                            activeSubmissionFilter === "all"
                                ? ""
                                : activeSubmissionFilter
                        } submissions
                    </h3>

                    <p>
                        Your submitted tasks and campaigns
                        will appear here.
                    </p>
                </div>
            `;

            return;
        }

        submissionList.innerHTML = submissions
            .map((item) => {
                const isCampaign =
                    item.submission_type === "campaign";

                return `
                    <div class="
                        submission-card
                        ${
                            isCampaign
                                ? "campaign-submission-card"
                                : ""
                        }
                    ">
                        <div>
                            <div class="submission-heading-row">

                                <span class="
                                    submission-type-badge
                                    ${
                                        isCampaign
                                            ? "campaign"
                                            : "task"
                                    }
                                ">
                                    ${
                                        isCampaign
                                            ? `
                                                <i class="fa fa-bullhorn"></i>
                                                SQUEEB Campaign
                                            `
                                            : `
                                                <i class="fa fa-list-check"></i>
                                                Task
                                            `
                                    }
                                </span>

                                <span class="
                                    submission-status
                                    ${escapeHtml(item.status)}
                                ">
                                    <i class="
                                        fa
                                        ${statusIcon(item.status)}
                                    "></i>

                                    ${statusLabel(item.status)}
                                </span>

                            </div>

                            <h3>
                                ${escapeHtml(
                                    item.task_title ||
                                    "Submission"
                                )}
                            </h3>

                            <p>
                                <i class="fa fa-globe"></i>

                                ${escapeHtml(
                                    item.platform ||
                                    "Platform"
                                )}
                            </p>

                            <p>
                                <i class="fa fa-calendar"></i>

                                Submitted:
                                ${escapeHtml(
                                    item.submitted_at ||
                                    ""
                                )}
                            </p>

                            ${
                                item.reviewed_at
                                    ? `
                                        <p>
                                            <i class="fa fa-check"></i>

                                            Reviewed:
                                            ${escapeHtml(
                                                item.reviewed_at
                                            )}
                                        </p>
                                    `
                                    : `
                                        <p>
                                            <i class="
                                                fa
                                                fa-hourglass-half
                                            "></i>

                                            Waiting for approval
                                        </p>
                                    `
                            }

                            ${
                                item.rejection_reason
                                    ? `
                                        <div class="
                                            submission-rejection-reason
                                        ">
                                            <strong>
                                                Rejection reason
                                            </strong>

                                            <p>
                                                ${escapeHtml(
                                                    item.rejection_reason
                                                )}
                                            </p>
                                        </div>
                                    `
                                    : ""
                            }

                            <div class="submission-links">
                                ${
                                    item.proof
                                        ? `
                                            <a
                                                href="${item.proof}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <i class="fa fa-image"></i>
                                                View Screenshot
                                            </a>
                                        `
                                        : ""
                                }

                                ${
                                    isCampaign && item.video_link
                                        ? `
                                            <a
                                                href="${item.video_link}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <i class="fa fa-video"></i>
                                                View Published Video
                                            </a>
                                        `
                                        : ""
                                }
                            </div>
                        </div>

                        <div class="submission-money">
                            <span>Reward</span>

                            <strong>
                                ${money(item.reward)}
                            </strong>

                            ${
                                item.status === "approved"
                                    ? `
                                        <small>
                                            Paid to wallet
                                        </small>
                                    `
                                    : item.status === "pending"
                                        ? `
                                            <small>
                                                Pending approval
                                            </small>
                                        `
                                        : `
                                            <small>
                                                Not paid
                                            </small>
                                        `
                            }
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    submissionTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            submissionTabs.forEach((button) => {
                button.classList.remove("active");
            });

            tab.classList.add("active");

            activeSubmissionFilter =
                tab.dataset.status || "all";

            renderSubmissions();
        });
    });

    // ==========================================================
    // RECENT ACTIVITIES
    // ==========================================================

    async function loadRecentActivities() {
        const activityList = document.getElementById(
            "activityList"
        );

        if (!activityList) {
            return;
        }

        try {
            const response = await fetch(
                "/api/recent-activities/",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                return;
            }

            const data = await parseJsonResponse(response);

            activityList.innerHTML = "";

            if (
                !data.activities ||
                data.activities.length === 0
            ) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <p>
                            No recent activity yet.
                        </p>
                    </div>
                `;

                return;
            }

            data.activities.forEach((activity) => {
                const platform = (
                    activity.platform ||
                    "task"
                ).toLowerCase();

                const image =
                    platform === "referral"
                        ? "logo.png"
                        : `${platform}.png`;

                const message =
                    activity.message ||
                    `@${activity.username || "user"} ` +
                    `just earned ${money(activity.amount)}`;

                activityList.innerHTML += `
                    <div class="activity-item">
                        <img
                            src="/static/accounts/img/${image}"
                            alt="${escapeHtml(platform)}"
                        >

                        <p>
                            ${escapeHtml(message)}
                        </p>
                    </div>
                `;
            });

        } catch (error) {
            console.error(
                "ACTIVITY LOAD ERROR:",
                error
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
                            "X-Requested-With":
                                "XMLHttpRequest",
                            "X-CSRFToken": getCookie("csrftoken")
                        }
                    }
                );

                const data = await parseJsonResponse(response);

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

                /*
                 * Refresh user information so the membership
                 * badge and withdrawal fee update immediately.
                 */
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
    // CLOSE TASK MODAL
    // ==========================================================

    function closeTaskModal() {
        if (taskModal) {
            taskModal.style.display = "none";
        }

        document.body.style.overflow = "";

        selectedTaskId = null;
        selectedTaskType = "task";

        const campaignVideoGroup =
            document.getElementById(
                "campaignVideoGroup"
            );

        if (campaignVideoGroup) {
            campaignVideoGroup.style.display = "none";
        }

        const campaignVideoLink =
            document.getElementById(
                "campaignVideoLink"
            );

        if (campaignVideoLink) {
            campaignVideoLink.value = "";
        }

        const proofInput =
            document.getElementById(
                "proofInput"
            );

        if (proofInput) {
            proofInput.value = "";
        }
    }

    cancelTaskBtn?.addEventListener(
        "click",
        closeTaskModal
    );

    window.addEventListener("click", (event) => {
        if (
            taskModal &&
            event.target === taskModal
        ) {
            closeTaskModal();
        }
    });

    window.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            taskModal &&
            taskModal.style.display === "flex"
        ) {
            closeTaskModal();
        }
    });


    // ==========================================================
    // INITIAL PAGE LOAD
    // ==========================================================

    loadUser();
    loadSubmissions();
    loadRecentActivities();

    window.addEventListener("pageshow", loadUser);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadUser();
        }
    });

    /*
     * Refresh recent activity periodically without reloading
     * the page.
     */
    setInterval(
        loadRecentActivities,
        30000
    );
});