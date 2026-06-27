document.addEventListener("DOMContentLoaded", () => {
    const taskList = document.getElementById("postedTaskList");

    const totalTasks = document.getElementById("totalTasks");
    const activeTasks = document.getElementById("activeTasks");
    const completedTasks = document.getElementById("completedTasks");

    function setText(element, value) {
        if (element) element.textContent = value;
    }

    function taskCard(task) {
        const status = task.status || "active";
        const isClosed = status === "completed" || status === "closed";

        return `
            <div class="posted-task-card">
                <div>
                    <span class="task-badge">${task.task_type || "Task"}</span>
                    <h3>${task.title || "Social Task"}</h3>
                    <p>${task.description || "No description available."}</p>

                    <div class="task-meta">
                        <span><i class="fa fa-globe"></i> ${task.platform || "Platform"}</span>
                        <span><i class="fa fa-users"></i> ${task.quantity || 0} actions</span>
                        <span><i class="fa fa-link"></i> Posted task</span>
                    </div>
                </div>

                <div class="task-status">
                    <strong>£${parseFloat(task.total_cost || 0).toFixed(2)}</strong>
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