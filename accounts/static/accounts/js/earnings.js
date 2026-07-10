document.addEventListener("DOMContentLoaded", () => {
    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    const membershipSection = document.getElementById("membershipSection");
    const taskSection = document.querySelector(".task-section");
    const payMembershipBtn = document.getElementById("payMembershipBtn");

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
        if (status === "approved") return "Approved";
        if (status === "rejected") return "Rejected";
        return "Pending";
    }

    function statusIcon(status) {
        if (status === "approved") return "fa-circle-check";
        if (status === "rejected") return "fa-circle-xmark";
        return "fa-clock";
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    }

    // ==========================================================
    // USER INFORMATION
    // ==========================================================

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (res.status === 401 || res.status === 403 || res.redirected) {
                window.location.href = "/login/";
                return;
            }

            if (!res.ok) {
                console.error("USER INFO ERROR:", res.status);
                return;
            }

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", `@${data.username || "user"}`);
            setText("balanceAmount", money(data.balance));
            setText("earningsTotal", money(data.earnings));
            setText("tasksCompleted", data.tasks_completed || 0);
            setText("referrals", data.referrals || 0);

            if (data.is_member) {
                if (membershipSection) {
                    membershipSection.style.display = "none";
                }

                if (taskSection) {
                    taskSection.style.display = "block";
                }

                loadTasks();
            } else {
                if (membershipSection) {
                    membershipSection.style.display = "flex";
                }

                if (taskSection) {
                    taskSection.style.display = "none";
                }
            }

        } catch (err) {
            console.error("USER LOAD ERROR:", err);
        }
    }

    // ==========================================================
    // AVAILABLE TASKS AND CAMPAIGNS
    // ==========================================================

    async function loadTasks() {
        const taskList = document.getElementById("taskList");

        if (!taskList) return;

        taskList.innerHTML = `
            <div class="empty-task">
                <i class="fa fa-spinner fa-spin"></i>
                <h3>Loading opportunities</h3>
                <p>Please wait while we load available tasks.</p>
            </div>
        `;

        try {
            const res = await fetch("/api/tasks/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await res.json();

            if (!res.ok) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-circle-exclamation"></i>
                        <h3>Unable to load tasks</h3>
                        <p>${escapeHtml(data.error || "Please try again.")}</p>
                    </div>
                `;
                return;
            }

            taskList.innerHTML = "";

            if (!data.tasks || data.tasks.length === 0) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-list-check"></i>
                        <h3>No tasks available</h3>
                        <p>New earning tasks will appear here when available.</p>
                    </div>
                `;
                return;
            }

            data.tasks.forEach((task) => {
                const isCampaign = task.featured === true;

                const platform = escapeHtml(task.platforms || "Task");
                const title = escapeHtml(task.title || "Untitled Task");

                const description = escapeHtml(
                    task.short_desc ||
                    task.instructions ||
                    "Complete this task and upload proof."
                );

                taskList.innerHTML += `
                    <div class="earn-task-card ${isCampaign ? "featured-campaign" : ""}">
                        <div>
                            <span class="task-badge">
                                ${
                                    isCampaign
                                        ? '<i class="fa fa-fire"></i> SQUEEB Campaign'
                                        : platform
                                }
                            </span>

                            <h3>${title}</h3>

                            <p>${description}</p>

                            <strong class="task-reward">
                                ${
                                    isCampaign
                                        ? `${money(task.payout)} reward`
                                        : `${money(task.payout)} per ${escapeHtml(task.task_type || "task")}`
                                }
                            </strong>

                            ${
                                isCampaign
                                    ? `<span class="campaign-slots">
                                           ${parseInt(task.available || 0)} slots remaining
                                       </span>`
                                    : ""
                            }
                        </div>

                        <button
                            type="button"
                            class="select-task-btn"
                            data-id="${task.id}"
                            data-featured="${isCampaign}"
                        >
                            ${isCampaign ? "Participate" : "Select Task"}
                        </button>
                    </div>
                `;
            });

        } catch (err) {
            console.error("TASK LOAD ERROR:", err);

            taskList.innerHTML = `
                <div class="empty-task">
                    <i class="fa fa-wifi"></i>
                    <h3>Network error</h3>
                    <p>Please check your connection and try again.</p>
                </div>
            `;
        }
    }

    // ==========================================================
    // OPEN TASK OR CAMPAIGN MODAL
    // ==========================================================

    document.addEventListener("click", async (e) => {
        const button = e.target.closest(".select-task-btn");

        if (!button) return;

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
            const res = await fetch(endpoint, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Unable to open this opportunity.");
                return;
            }

            setText("modalTaskTitle", data.title || "Task");
            setText("modalPlatform", data.platform || "");
            setText("modalType", data.task_type || "");
            setText("modalTaskReward", `Earn ${money(data.payout)}`);

            const instructionsBox = document.getElementById(
                "modalTaskInstructions"
            );

            if (instructionsBox) {
                if (Array.isArray(data.instructions)) {
                    instructionsBox.innerHTML = `
                        <ul>
                            ${data.instructions
                                .map((step) => `<li>${escapeHtml(step)}</li>`)
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

            const linkEl = document.getElementById("modalTaskLink");

            if (linkEl) {
                if (data.link) {
                    linkEl.href = data.link;
                    linkEl.style.display = "inline-flex";
                } else {
                    linkEl.removeAttribute("href");
                    linkEl.style.display = "none";
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

            const proofInput = document.getElementById("proofInput");

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
                taskModal.style.display = "flex";
            }

        } catch (err) {
            console.error("OPPORTUNITY LOAD ERROR:", err);
            alert("Network error. Please try again.");

        } finally {
            button.disabled = false;
            button.textContent = originalButtonText;
        }
    });

    // ==========================================================
    // SUBMIT TASK OR CAMPAIGN PROOF
    // ==========================================================

    submitProofBtn?.addEventListener("click", async () => {
        const fileInput = document.getElementById("proofInput");
        const file = fileInput?.files[0];

        if (!selectedTaskId) {
            alert("No task or campaign selected.");
            return;
        }

        if (!file) {
            alert("Please upload screenshot proof.");
            return;
        }

        const formData = new FormData();
        formData.append("proof", file);

        if (selectedTaskType === "campaign") {
            const campaignVideoLink = document
                .getElementById("campaignVideoLink")
                ?.value.trim();

            if (!campaignVideoLink) {
                alert("Please enter your published social media video link.");
                return;
            }

            formData.append("video_link", campaignVideoLink);
        }

        const endpoint =
            selectedTaskType === "campaign"
                ? `/api/campaign/${selectedTaskId}/submit/`
                : `/api/complete-task/${selectedTaskId}/`;

        submitProofBtn.disabled = true;
        submitProofBtn.textContent = "Submitting...";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                credentials: "include",
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
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

            loadUser();
            loadTasks();
            loadSubmissions();
            loadRecentActivities();

        } catch (err) {
            console.error("PROOF SUBMIT ERROR:", err);
            alert("Network error. Please try again.");

        } finally {
            submitProofBtn.disabled = false;
            submitProofBtn.textContent = "Submit Proof";
        }
    });

    // ==========================================================
    // USER SUBMISSIONS
    // ==========================================================

    async function loadSubmissions() {
        if (!submissionList) return;

        try {
            const res = await fetch("/api/my-task-submissions/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) return;

            const data = await res.json();

            allSubmissions = data.submissions || [];

            renderSubmissions();

        } catch (err) {
            console.error("SUBMISSIONS LOAD ERROR:", err);
        }
    }

    function renderSubmissions() {
    if (!submissionList) return;

    let submissions = allSubmissions;

    if (activeSubmissionFilter !== "all") {
        submissions = allSubmissions.filter(
            (item) => item.status === activeSubmissionFilter
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

                <p>Your submitted tasks and campaigns will appear here.</p>
            </div>
        `;
        return;
    }

    submissionList.innerHTML = submissions.map((item) => {
        const isCampaign = item.submission_type === "campaign";

        return `
            <div class="submission-card ${isCampaign ? "campaign-submission-card" : ""}">
                <div>
                    <div class="submission-heading-row">
                        <span class="submission-type-badge ${isCampaign ? "campaign" : "task"}">
                            ${
                                isCampaign
                                    ? '<i class="fa fa-bullhorn"></i> SQUEEB Campaign'
                                    : '<i class="fa fa-list-check"></i> Task'
                            }
                        </span>

                        <span class="submission-status ${escapeHtml(item.status)}">
                            <i class="fa ${statusIcon(item.status)}"></i>
                            ${statusLabel(item.status)}
                        </span>
                    </div>

                    <h3>${escapeHtml(item.task_title || "Submission")}</h3>

                    <p>
                        <i class="fa fa-globe"></i>
                        ${escapeHtml(item.platform || "Platform")}
                    </p>

                    <p>
                        <i class="fa fa-calendar"></i>
                        Submitted: ${escapeHtml(item.submitted_at || "")}
                    </p>

                    ${
                        item.reviewed_at
                            ? `
                                <p>
                                    <i class="fa fa-check"></i>
                                    Reviewed: ${escapeHtml(item.reviewed_at)}
                                </p>
                            `
                            : `
                                <p>
                                    <i class="fa fa-hourglass-half"></i>
                                    Waiting for approval
                                </p>
                            `
                    }

                    ${
                        item.rejection_reason
                            ? `
                                <div class="submission-rejection-reason">
                                    <strong>Rejection reason</strong>
                                    <p>${escapeHtml(item.rejection_reason)}</p>
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
                    <strong>${money(item.reward)}</strong>

                    ${
                        item.status === "approved"
                            ? `<small>Paid to wallet</small>`
                            : item.status === "pending"
                                ? `<small>Pending approval</small>`
                                : `<small>Not paid</small>`
                    }
                </div>
            </div>
        `;
    }).join("");
}



    submissionTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            submissionTabs.forEach((btn) => {
                btn.classList.remove("active");
            });

            tab.classList.add("active");
            activeSubmissionFilter = tab.dataset.status;

            renderSubmissions();
        });
    });

    // ==========================================================
    // RECENT ACTIVITIES
    // ==========================================================

    async function loadRecentActivities() {
        const activityList = document.getElementById("activityList");

        if (!activityList) return;

        try {
            const res = await fetch("/api/recent-activities/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) return;

            const data = await res.json();

            activityList.innerHTML = "";

            if (!data.activities || data.activities.length === 0) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <p>No recent activity yet.</p>
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
                    `@${activity.username || "user"} just earned £${parseFloat(
                        activity.amount || 0
                    ).toFixed(2)}`;

                activityList.innerHTML += `
                    <div class="activity-item">
                        <img
                            src="/static/accounts/img/${image}"
                            alt="${escapeHtml(platform)}"
                        >

                        <p>${escapeHtml(message)}</p>
                    </div>
                `;
            });

        } catch (err) {
            console.error("ACTIVITY LOAD ERROR:", err);
        }
    }

    // ==========================================================
    // MEMBERSHIP
    // ==========================================================

    payMembershipBtn?.addEventListener("click", async () => {
        payMembershipBtn.disabled = true;
        payMembershipBtn.textContent = "Processing...";

        try {
            const res = await fetch("/pay-membership/", {
                method: "POST",
                credentials: "include",
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

            if (membershipSection) {
                membershipSection.style.display = "none";
            }

            if (taskSection) {
                taskSection.style.display = "block";
            }

            loadUser();
            loadTasks();

        } catch (err) {
            console.error("MEMBERSHIP ERROR:", err);
            alert("Network error.");

        } finally {
            payMembershipBtn.disabled = false;
            payMembershipBtn.textContent = "Activate Membership";
        }
    });

    // ==========================================================
    // CLOSE MODAL
    // ==========================================================

    function closeTaskModal() {
        if (taskModal) {
            taskModal.style.display = "none";
        }

        selectedTaskId = null;
        selectedTaskType = "task";

        const campaignVideoGroup = document.getElementById(
            "campaignVideoGroup"
        );

        if (campaignVideoGroup) {
            campaignVideoGroup.style.display = "none";
        }
    }

    cancelTaskBtn?.addEventListener("click", closeTaskModal);

    window.addEventListener("click", (e) => {
        if (taskModal && e.target === taskModal) {
            closeTaskModal();
        }
    });

    // ==========================================================
    // INITIAL LOAD
    // ==========================================================

    loadUser();
    loadSubmissions();
    loadRecentActivities();

    setInterval(loadRecentActivities, 5000);
});