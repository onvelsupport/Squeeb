document.addEventListener("DOMContentLoaded", () => {
    const taskList = document.getElementById("postedTaskList");

    const totalTasks = document.getElementById("totalTasks");
    const activeTasks = document.getElementById("activeTasks");
    const completedTasks = document.getElementById("completedTasks");

    function setText(element, value) {
        if (element) element.textContent = value;
    }

    function money(value) {
        return `£${parseFloat(value || 0).toFixed(2)}`;
    }

    function taskCard(task) {
        const status = task.status || "active";
        const isClosed = status === "completed" || status === "closed";

        return `
            <div class="posted-task-card">

                <div class="task-main">
                    <span class="task-badge">${task.task_type || "Task"}</span>

                    <h3>${task.title || "Social Task"}</h3>

                    <p>${task.description || "No description available."}</p>

                    <div class="task-meta">
                        <span>
                            <i class="fa fa-globe"></i>
                            ${task.platform || "Platform"}
                        </span>

                        <span>
                            <i class="fa fa-link"></i>
                            ${
                                task.link
                                    ? `<a href="${task.link}" target="_blank">View Link</a>`
                                    : "Posted task"
                            }
                        </span>
                    </div>

                    <div class="task-stats">

                        <div class="stat-box">
                            <div class="stat-icon blue">
                                <i class="fa fa-users"></i>
                            </div>
                            <div>
                                <strong>${task.quantity || 0}</strong>
                                <span>Total</span>
                            </div>
                        </div>

                        <div class="stat-box">
                            <div class="stat-icon orange">
                                <i class="fa fa-clock"></i>
                            </div>
                            <div>
                                <strong>${task.pending || 0}</strong>
                                <span>Pending</span>
                            </div>
                        </div>

                        <div class="stat-box">
                            <div class="stat-icon green">
                                <i class="fa fa-circle-check"></i>
                            </div>
                            <div>
                                <strong>${task.completed || 0}</strong>
                                <span>Approved</span>
                            </div>
                        </div>

                        <div class="stat-box">
                            <div class="stat-icon purple">
                                <i class="fa fa-box"></i>
                            </div>
                            <div>
                                <strong>${task.available || 0}</strong>
                                <span>Remaining</span>
                            </div>
                        </div>

                    </div>

                    <a href="/my-tasks/${task.id}/reviews/" class="review-submissions-btn">
                        <i class="fa fa-check-circle"></i>
                        Review Submissions
                    </a>
                </div>

                <div class="task-status">
                    <strong>${money(task.total_cost)}</strong>

                    <small>
                        ${money(task.worker_reward)} per action
                    </small>

                    <span class="status-pill ${isClosed ? "closed" : ""}">
                        ${isClosed ? "Completed" : "Active"}
                    </span>
                </div>

            </div>
        `;
    }

    async function loadMyTasks() {
        try {
            const res = await fetch("/api/my-tasks/", {
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-triangle-exclamation"></i>
                        <h3>Could not load tasks</h3>
                        <p>Please refresh the page and try again.</p>
                    </div>
                `;
                return;
            }

            const data = await res.json();
            const tasks = data.tasks || [];

            setText(totalTasks, data.total || tasks.length || 0);
            setText(activeTasks, data.active || 0);
            setText(completedTasks, data.completed || 0);

            if (!tasks.length) {
                taskList.innerHTML = `
                    <div class="empty-task">
                        <i class="fa fa-list-check"></i>
                        <h3>No posted tasks yet</h3>
                        <p>Tasks you create from the dashboard will appear here.</p>
                    </div>
                `;
                return;
            }

            taskList.innerHTML = tasks.map(taskCard).join("");

        } catch (err) {
            console.error("My tasks error:", err);

            taskList.innerHTML = `
                <div class="empty-task">
                    <i class="fa fa-wifi"></i>
                    <h3>Network error</h3>
                    <p>Please check your connection and try again.</p>
                </div>
            `;
        }
    }

    loadMyTasks();
});