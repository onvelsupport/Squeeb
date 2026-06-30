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
    let allSubmissions = [];
    let activeSubmissionFilter = "all";

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
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

    async function loadUser() {
        try {
            const res = await fetch("/api/user-info/", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (res.status === 401 || res.status === 403 || res.redirected) {
                window.location.href = "/login/";
                return;
            }

            if (!res.ok) return;

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", "@" + (data.username || "user"));
            setText("balanceAmount", money(data.balance));
            setText("earningsTotal", money(data.earnings));
            setText("tasksCompleted", data.tasks_completed || 0);
            setText("referrals", data.referrals || 0);

            if (data.is_member) {
                if (membershipSection) membershipSection.style.display = "none";
                if (taskSection) taskSection.style.display = "block";
                loadTasks();
            } else {
                if (membershipSection) membershipSection.style.display = "flex";
                if (taskSection) taskSection.style.display = "none";
            }

        } catch (err) {
            console.error("USER LOAD ERROR:", err);
        }
    }

    async function loadTasks() {
        const taskList = document.getElementById("taskList");
        if (!taskList) return;

        try {
            const res = await fetch("/api/tasks/", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) return;

            const data = await res.json();
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
                taskList.innerHTML += `
                    <div class="earn-task-card">
                        <div>
                            <span class="task-badge">${task.platforms || "Task"}</span>
                            <h3>${task.title || "Untitled Task"}</h3>
                            <p>${task.short_desc || task.instructions || "Complete this task and upload proof."}</p>
                            <strong class="task-reward">
                                ${money(task.payout)} per ${task.task_type || "task"}
                            </strong>
                        </div>

                        <button class="select-task-btn" data-id="${task.id}">
                            Select Task
                        </button>
                    </div>
                `;
            });

        } catch (err) {
            console.error("TASK LOAD ERROR:", err);
        }
    }

    async function loadSubmissions() {
        if (!submissionList) return;

        try {
            const res = await fetch("/api/my-task-submissions/", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
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
                item => item.status === activeSubmissionFilter
            );
        }

        if (!submissions.length) {
            submissionList.innerHTML = `
                <div class="empty-task">
                    <i class="fa fa-clock"></i>
                    <h3>No ${activeSubmissionFilter === "all" ? "" : activeSubmissionFilter} submissions</h3>
                    <p>Your submitted tasks will appear here.</p>
                </div>
            `;
            return;
        }

        submissionList.innerHTML = submissions.map(item => `
            <div class="submission-card">
                <div>
                    <span class="submission-status ${item.status}">
                        <i class="fa ${statusIcon(item.status)}"></i>
                        ${statusLabel(item.status)}
                    </span>

                    <h3>${item.task_title}</h3>

                    <p>
                        <i class="fa fa-globe"></i>
                        ${item.platform || "Platform"}
                    </p>

                    <p>
                        <i class="fa fa-calendar"></i>
                        Submitted: ${item.submitted_at}
                    </p>

                    ${
                        item.reviewed_at
                            ? `<p><i class="fa fa-check"></i> Reviewed: ${item.reviewed_at}</p>`
                            : `<p><i class="fa fa-hourglass-half"></i> Waiting for task creator approval</p>`
                    }
                </div>

                <div class="submission-money">
                    <strong>${money(item.reward)}</strong>
                    ${
                        item.proof
                            ? `<a href="${item.proof}" target="_blank">View Proof</a>`
                            : ""
                    }
                </div>
            </div>
        `).join("");
    }

    submissionTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            submissionTabs.forEach(btn => btn.classList.remove("active"));
            tab.classList.add("active");
            activeSubmissionFilter = tab.dataset.status;
            renderSubmissions();
        });
    });

    async function loadRecentActivities() {
        const activityList = document.getElementById("activityList");
        if (!activityList) return;

        try {
            const res = await fetch("/api/recent-activities/", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
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
    const platform = (activity.platform || "task").toLowerCase();
    const amount = parseFloat(activity.amount || 0).toFixed(2);

    const image = platform === "referral"
        ? "logo.png"
        : `${platform}.png`;

    const message = platform === "referral"
        ? `<strong>@${activity.username || "user"}</strong> earned £${amount} from a referral`
        : `<strong>@${activity.username || "user"}</strong> just earned £${amount}`;

    activityList.innerHTML += `
        <div class="activity-item">
            <img src="/static/accounts/img/${image}" alt="${platform}">
            <p>${message}</p>
        </div>
    `;
});

        } catch (err) {
            console.error("ACTIVITY LOAD ERROR:", err);
        }
    }

    document.addEventListener("click", async (e) => {
        const button = e.target.closest(".select-task-btn");
        if (!button) return;

        selectedTaskId = button.dataset.id;

        try {
            const res = await fetch(`/api/task/${selectedTaskId}/`, {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) return;

            const task = await res.json();

            setText("modalTaskTitle", task.title || "Task");
            setText("modalPlatform", task.platform || "");
            setText("modalType", task.task_type || "");
            setText("modalTaskReward", `Earn ${money(task.payout)}`);

            const instructionsBox = document.getElementById("modalTaskInstructions");

            if (instructionsBox) {
                if (Array.isArray(task.instructions)) {
                    instructionsBox.innerHTML = `
                        <ul>
                            ${task.instructions.map((step) => `<li>${step}</li>`).join("")}
                        </ul>
                    `;
                } else {
                    instructionsBox.innerHTML = `
                        <ul>
                            <li>${task.instructions || "Complete the task and upload proof."}</li>
                        </ul>
                    `;
                }
            }

            const linkEl = document.getElementById("modalTaskLink");

            if (linkEl) {
                if (task.link) {
                    linkEl.href = task.link;
                    linkEl.style.display = "inline-block";
                } else {
                    linkEl.style.display = "none";
                }
            }

            const proofInput = document.getElementById("proofInput");
            if (proofInput) proofInput.value = "";

            if (taskModal) taskModal.style.display = "flex";

        } catch (err) {
            console.error("MODAL LOAD ERROR:", err);
        }
    });

    submitProofBtn?.addEventListener("click", async () => {
        const fileInput = document.getElementById("proofInput");
        const file = fileInput?.files[0];

        if (!selectedTaskId) {
            alert("No task selected.");
            return;
        }

        if (!file) {
            alert("Please upload screenshot proof.");
            return;
        }

        const formData = new FormData();
        formData.append("proof", file);

        submitProofBtn.disabled = true;
        submitProofBtn.textContent = "Submitting...";

        try {
            const res = await fetch(`/api/complete-task/${selectedTaskId}/`, {
                method: "POST",
                credentials: "include",
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Proof submission failed.");
                return;
            }

            alert(data.message || "Task submitted for review.");

            if (taskModal) taskModal.style.display = "none";

            loadUser();
            loadTasks();
            loadSubmissions();
            loadRecentActivities();

        } catch (err) {
            console.error("PROOF SUBMIT ERROR:", err);
            alert("Network error.");
        } finally {
            submitProofBtn.disabled = false;
            submitProofBtn.textContent = "Submit Proof";
        }
    });

    payMembershipBtn?.addEventListener("click", async () => {
        payMembershipBtn.disabled = true;
        payMembershipBtn.textContent = "Processing...";

        try {
            const res = await fetch("/pay-membership/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Membership payment failed.");
                return;
            }

            alert(data.message || "Membership activated.");

            if (membershipSection) membershipSection.style.display = "none";
            if (taskSection) taskSection.style.display = "block";

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

    cancelTaskBtn?.addEventListener("click", () => {
        if (taskModal) taskModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (taskModal && e.target === taskModal) {
            taskModal.style.display = "none";
        }
    });

    loadUser();
    loadSubmissions();
    loadRecentActivities();

    setInterval(loadRecentActivities, 5000);
});