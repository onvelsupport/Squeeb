document.addEventListener("DOMContentLoaded", () => {

    const taskList =
        document.getElementById("postedTaskList");

    const totalTasks =
        document.getElementById("totalTasks");

    const activeTasks =
        document.getElementById("activeTasks");

    const completedTasks =
        document.getElementById("completedTasks");


    if (!taskList) {
        return;
    }


    /* ==========================================================
       MONEY
    ========================================================== */

    const money = (value) => {

        const amount =
            Number.parseFloat(
                value || 0
            );


        return new Intl.NumberFormat(
            "en-GB",
            {
                style: "currency",
                currency: "GBP",
            }
        ).format(
            Number.isFinite(amount)
                ? amount
                : 0
        );

    };


    /* ==========================================================
       ESCAPE HTML
    ========================================================== */

    const escapeHtml = (value) => {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    };


    /* ==========================================================
       EXTERNAL URL NORMALIZER
    ========================================================== */

    const safeExternalUrl = (value) => {

        if (!value) {
            return "";
        }


        let cleanUrl =
            String(value).trim();


        if (!cleanUrl) {
            return "";
        }


        /*
         * If the user entered:
         *
         * instagram.com/example
         *
         * convert it to:
         *
         * https://instagram.com/example
         */

        if (
            !cleanUrl.startsWith("http://") &&
            !cleanUrl.startsWith("https://")
        ) {

            cleanUrl =
                `https://${cleanUrl}`;

        }


        try {

            const url =
                new URL(cleanUrl);


            if (
                ![
                    "http:",
                    "https:"
                ].includes(
                    url.protocol
                )
            ) {

                return "";

            }


            return url.href;


        } catch (error) {

            console.warn(
                "INVALID TASK URL:",
                value
            );


            return "";

        }

    };


    /* ==========================================================
       TEXT HELPER
    ========================================================== */

    function setText(
        element,
        value
    ) {

        if (element) {

            element.textContent =
                value;

        }

    }


    /* ==========================================================
       TASK CARD
    ========================================================== */

    function taskCard(task) {

        const status =
            String(
                task.status || "active"
            ).toLowerCase();


        const isClosed =
            [
                "completed",
                "closed"
            ].includes(
                status
            );


        const taskType =
            escapeHtml(
                task.task_type ||
                "Task"
            );


        const title =
            escapeHtml(
                task.title ||
                "Social Task"
            );


        const description =
            escapeHtml(
                task.description ||
                "No description available."
            );


        const platform =
            escapeHtml(
                task.platform ||
                "Platform"
            );


        const taskUrl =
            safeExternalUrl(
                task.link
            );


        const reviewUrl =
            `/my-tasks/${
                encodeURIComponent(
                    task.id
                )
            }/reviews/`;


        const linkMarkup =
            taskUrl
                ? `
                    <a
                        href="${escapeHtml(taskUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="task-external-link"
                    >
                        View link
                    </a>
                `
                : `
                    <span class="task-link-unavailable">
                        No link
                    </span>
                `;


        return `
            <article class="posted-task-card">

                <div class="task-main">

                    <div class="task-top-row">

                        <span class="task-badge">
                            ${taskType}
                        </span>


                        <span
                            class="
                                task-status-pill
                                ${isClosed ? "closed" : ""}
                            "
                        >
                            ${
                                isClosed
                                    ? "Completed"
                                    : "Active"
                            }
                        </span>

                    </div>


                    <h3>
                        ${title}
                    </h3>


                    <p>
                        ${description}
                    </p>


                    <div class="task-meta">

                        <span>
                            <i class="fa-solid fa-globe"></i>
                            ${platform}
                        </span>


                        <span>
                            <i class="fa-solid fa-link"></i>

                            ${linkMarkup}
                        </span>

                    </div>


                    <div class="task-stats">

                        <div class="stat-box">

                            <div class="stat-icon blue">

                                <i
                                    class="fa-solid fa-users"
                                ></i>

                            </div>


                            <strong>
                                ${
                                    Number.parseInt(
                                        task.quantity || 0,
                                        10
                                    )
                                }
                            </strong>


                            <span>
                                Total
                            </span>

                        </div>


                        <div class="stat-box">

                            <div class="stat-icon orange">

                                <i
                                    class="fa-solid fa-clock"
                                ></i>

                            </div>


                            <strong>
                                ${
                                    Number.parseInt(
                                        task.pending || 0,
                                        10
                                    )
                                }
                            </strong>


                            <span>
                                Pending
                            </span>

                        </div>


                        <div class="stat-box">

                            <div class="stat-icon green">

                                <i
                                    class="fa-solid fa-circle-check"
                                ></i>

                            </div>


                            <strong>
                                ${
                                    Number.parseInt(
                                        task.completed || 0,
                                        10
                                    )
                                }
                            </strong>


                            <span>
                                Approved
                            </span>

                        </div>


                        <div class="stat-box">

                            <div class="stat-icon purple">

                                <i
                                    class="fa-solid fa-box"
                                ></i>

                            </div>


                            <strong>
                                ${
                                    Number.parseInt(
                                        task.available || 0,
                                        10
                                    )
                                }
                            </strong>


                            <span>
                                Remaining
                            </span>

                        </div>

                    </div>


                    <a
                        href="${reviewUrl}"
                        class="review-submissions-btn"
                    >

                        <i
                            class="fa-solid fa-circle-check"
                        ></i>

                        Review submissions

                    </a>

                </div>


                <div class="task-status">

                    <span>
                        Budget
                    </span>


                    <strong>
                        ${money(task.total_cost)}
                    </strong>


                    <small>
                        ${money(task.worker_reward)}
                        per action
                    </small>

                </div>

            </article>
        `;

    }


    /* ==========================================================
       LOAD TASKS
    ========================================================== */

    let loadPromise =
        null;


    async function loadMyTasks() {

        if (loadPromise) {

            return loadPromise;

        }


        loadPromise =
            (async () => {

                try {

                    const response =
                        await fetch(
                            "/api/my-tasks/",
                            {
                                credentials:
                                    "same-origin",

                                headers: {
                                    Accept:
                                        "application/json",
                                },
                            }
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Could not load tasks."
                        );

                    }


                    const data =
                        await response.json();


                    const tasks =
                        Array.isArray(
                            data.tasks
                        )
                            ? data.tasks
                            : [];


                    /* ==========================================
                       TOTAL TASKS
                    ========================================== */

                    setText(
                        totalTasks,

                        Number.isFinite(
                            Number(
                                data.total
                            )
                        )
                            ? data.total
                            : tasks.length
                    );


                    /* ==========================================
                       ACTIVE TASKS
                    ========================================== */

                    setText(
                        activeTasks,

                        Number.isFinite(
                            Number(
                                data.active
                            )
                        )
                            ? data.active
                            : tasks.filter(
                                task =>
                                    ![
                                        "completed",
                                        "closed"
                                    ].includes(
                                        String(
                                            task.status ||
                                            ""
                                        ).toLowerCase()
                                    )
                            ).length
                    );


                    /* ==========================================
                       COMPLETED TASKS
                    ========================================== */

                    setText(
                        completedTasks,

                        Number.isFinite(
                            Number(
                                data.completed
                            )
                        )
                            ? data.completed
                            : tasks.filter(
                                task =>
                                    [
                                        "completed",
                                        "closed"
                                    ].includes(
                                        String(
                                            task.status ||
                                            ""
                                        ).toLowerCase()
                                    )
                            ).length
                    );


                    /* ==========================================
                       EMPTY STATE
                    ========================================== */

                    if (!tasks.length) {

                        taskList.innerHTML = `
                            <div class="empty-task">

                                <i
                                    class="fa-solid fa-list-check"
                                ></i>

                                <h3>
                                    No posted tasks yet
                                </h3>

                                <p>
                                    Tasks you create from the dashboard
                                    will appear here.
                                </p>

                            </div>
                        `;


                        return;

                    }


                    /* ==========================================
                       RENDER CARDS
                    ========================================== */

                    taskList.innerHTML =
                        tasks
                            .map(
                                taskCard
                            )
                            .join("");


                } catch (error) {

                    console.error(
                        "MY TASKS ERROR:",
                        error
                    );


                    taskList.innerHTML = `
                        <div class="empty-task">

                            <i
                                class="fa-solid fa-triangle-exclamation"
                            ></i>

                            <h3>
                                Unable to load tasks
                            </h3>

                            <p>
                                Please refresh the page and try again.
                            </p>

                        </div>
                    `;


                } finally {

                    loadPromise =
                        null;

                }

            })();


        return loadPromise;

    }


    /* ==========================================================
       INITIAL LOAD
    ========================================================== */

    loadMyTasks();

});