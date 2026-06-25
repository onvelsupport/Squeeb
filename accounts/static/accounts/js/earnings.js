document.addEventListener("DOMContentLoaded", () => {
    const money = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

    const membershipSection = document.getElementById("membershipSection");
    const taskSection = document.getElementById("taskSection");
    const payMembershipBtn = document.getElementById("payMembershipBtn");

    const taskModal = document.getElementById("taskModal");
    const cancelTaskBtn = document.getElementById("cancelTaskBtn");
    const submitProofBtn = document.getElementById("submitProofBtn");

    let selectedTaskId = null;

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

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
                console.error("User info failed:", res.status);
                return;
            }

            const data = await res.json();

            setText("usernameDisplay", data.username || "User");
            setText("usernameTag", "@" + (data.username || "user"));
            setText("usernameDynamic", data.username || "User");

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

        const res = await fetch(
            `/api/search/?q=${encodeURIComponent(query)}`
        );

        const data = await res.json();

        searchResults.innerHTML = "";

        if (!data.results.length) {

            searchResults.innerHTML =
                `<div class="search-item">No results found</div>`;

            searchResults.style.display = "block";

            return;
        }

        data.results.forEach(item => {

            searchResults.innerHTML += `
                <a href="${item.url}" class="search-item">

                    <strong>${item.name}</strong>

                    <div class="search-type">
                        ${item.type}
                    </div>

                </a>
            `;

        });

        searchResults.style.display = "block";

    }

    catch(err) {

        console.error(err);

    }

});



    async function loadTasks() {
        try {
            const res = await fetch("/api/tasks/", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                console.error("Task load failed:", res.status);
                return;
            }

            const data = await res.json();
            const taskList = document.getElementById("taskList");

            if (!taskList) return;

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
                            <span class="task-badge">${task.platform || "Task"}</span>

                            <h3>${task.title || "Untitled Task"}</h3>

                            <p>
                                ${task.instructions || "Complete this task and upload proof."}
                            </p>

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

            if (!res.ok) {
                console.error("Activity load failed:", res.status);
                return;
            }

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
                const platform = (activity.platform || "facebook").toLowerCase();
                const amount = parseFloat(activity.amount || 0).toFixed(2);

                activityList.innerHTML += `
                    <div class="activity-item">
                        <img src="/static/accounts/img/${platform}.png" alt="${platform}">

                        <p>
                            <strong>@${activity.username || "user"}</strong>
                            just earned £${amount}
                        </p>
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
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                console.error("Task fetch failed:", res.status);
                return;
            }

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

            alert(data.message || "Task completed. Balance updated.");

            if (taskModal) taskModal.style.display = "none";

            loadUser();
            loadTasks();
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

    document.querySelectorAll(".logout").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();

            try {
                await fetch("/api/logout/", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            } catch (err) {
                console.error("LOGOUT ERROR:", err);
            }

            window.location.href = "/login/";
        });
    });

    loadUser();
    loadRecentActivities();

    setInterval(loadRecentActivities, 5000);
});