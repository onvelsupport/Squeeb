document.addEventListener("DOMContentLoaded", () => {
    const reviewPage = document.getElementById("reviewPage");
    const reviewList = document.getElementById("reviewList");
    const reviewCount = document.getElementById("reviewCount");

    if (!reviewPage || !reviewList) {
        return;
    }

    const taskId = reviewPage.dataset.taskId;

    let loadPromise = null;
    const processing = new Set();

    function getCookie(name) {
        const cookies = document.cookie
            ? document.cookie.split(";")
            : [];

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith(`${name}=`)) {
                return decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
            }
        }

        return "";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function money(value) {
        const amount = Number.parseFloat(value || 0);

        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
        }).format(Number.isFinite(amount) ? amount : 0);
    }

    function safeMediaUrl(value) {
        if (!value) {
            return "";
        }

        try {
            const url = new URL(
                value,
                window.location.origin
            );

            if (!["http:", "https:"].includes(url.protocol)) {
                return "";
            }

            return url.href;
        } catch {
            return "";
        }
    }

    async function parseJson(response) {
        const type = response.headers.get("content-type") || "";

        if (!type.includes("application/json")) {
            return {};
        }

        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    function submissionCard(item) {
        const id = Number.parseInt(item.id, 10);
        const worker = escapeHtml(item.worker || "worker");
        const submittedAt = escapeHtml(
            item.submitted_at || "Date unavailable"
        );

        const proofUrl = safeMediaUrl(item.proof);

        const proofMarkup = proofUrl
            ? `
                <div class="proof-card">
                    <a
                        href="${proofUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="proof-link"
                    >
                        <img
                            src="${proofUrl}"
                            class="proof-img"
                            alt="Task proof from @${worker}"
                            loading="lazy"
                        >
                    </a>

                    <div class="proof-footer">
                        <span>Screenshot proof</span>
                        <span>
                            <i class="fa-solid fa-up-right-from-square"></i>
                            Open
                        </span>
                    </div>
                </div>
            `
            : `
                <div class="proof-card no-proof">
                    No proof uploaded.
                </div>
            `;

        return `
            <article
                class="review-card"
                data-completion-id="${id}"
            >
                <div class="review-main">

                    <div class="review-top-row">

                        <div class="review-worker">
                            <div class="review-worker-avatar">
                                <i class="fa-solid fa-user"></i>
                            </div>

                            <div>
                                <strong>@${worker}</strong>
                                <small>Worker submission</small>
                            </div>
                        </div>

                        <div class="review-reward">
                            <span>Reward</span>
                            <strong>${money(item.reward)}</strong>
                        </div>

                    </div>

                    <div class="review-meta">
                        <span>
                            <i class="fa-solid fa-calendar"></i>
                            ${submittedAt}
                        </span>

                        <span>
                            <i class="fa-solid fa-clock"></i>
                            Pending review
                        </span>
                    </div>

                    <div class="review-actions">

                        <button
                            type="button"
                            class="approve-btn review-action-btn"
                            data-action="approve"
                            data-id="${id}"
                        >
                            <i class="fa-solid fa-check"></i>
                            Approve
                        </button>

                        <button
                            type="button"
                            class="reject-btn review-action-btn"
                            data-action="reject"
                            data-id="${id}"
                        >
                            <i class="fa-solid fa-xmark"></i>
                            Reject
                        </button>

                    </div>

                </div>

                ${proofMarkup}

            </article>
        `;
    }

    async function loadSubmissions() {
        if (loadPromise) {
            return loadPromise;
        }

        loadPromise = (async () => {
            try {
                const response = await fetch(
                    `/api/my-tasks/${encodeURIComponent(taskId)}/reviews/`,
                    {
                        credentials: "same-origin",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                const data = await parseJson(response);

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "Could not load submissions."
                    );
                }

                const submissions = Array.isArray(data.submissions)
                    ? data.submissions
                    : [];

                if (reviewCount) {
                    reviewCount.textContent =
                        `${submissions.length} pending`;
                }

                if (!submissions.length) {
                    reviewList.innerHTML = `
                        <div class="empty-review">
                            <i class="fa-solid fa-circle-check"></i>
                            <h3>No pending submissions</h3>
                            <p>
                                New worker proof will appear here
                                when it is submitted.
                            </p>
                        </div>
                    `;
                    return;
                }

                reviewList.innerHTML = submissions
                    .map(submissionCard)
                    .join("");

            } catch (error) {
                console.error(
                    "REVIEW LOAD ERROR:",
                    error
                );

                if (reviewCount) {
                    reviewCount.textContent = "Unavailable";
                }

                reviewList.innerHTML = `
                    <div class="empty-review">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Could not load submissions</h3>
                        <p>
                            ${escapeHtml(
                                error.message ||
                                "Please try again."
                            )}
                        </p>
                    </div>
                `;
            } finally {
                loadPromise = null;
            }
        })();

        return loadPromise;
    }

    async function reviewSubmission(
        completionId,
        action,
        button
    ) {
        const key = `${completionId}:${action}`;

        if (processing.has(key)) {
            return;
        }

        const approving = action === "approve";

        const confirmed = window.confirm(
            approving
                ? "Approve this proof and credit the worker?"
                : "Reject this proof?"
        );

        if (!confirmed) {
            return;
        }

        processing.add(key);

        const card = button.closest(".review-card");
        const buttons = card?.querySelectorAll(
            ".review-action-btn"
        );

        buttons?.forEach((item) => {
            item.disabled = true;
        });

        const originalText = button.innerHTML;

        button.innerHTML = approving
            ? `<i class="fa-solid fa-spinner fa-spin"></i> Approving`
            : `<i class="fa-solid fa-spinner fa-spin"></i> Rejecting`;

        try {
            const response = await fetch(
                `/task-completions/${encodeURIComponent(completionId)}/${action}/`,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                        "X-Requested-With": "XMLHttpRequest",
                    },
                }
            );

            const data = await parseJson(response);

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Something went wrong."
                );
            }

            if (card) {
                card.style.opacity = ".45";
                card.style.pointerEvents = "none";

                window.setTimeout(() => {
                    card.remove();

                    const remaining = reviewList.querySelectorAll(
                        ".review-card"
                    ).length;

                    if (reviewCount) {
                        reviewCount.textContent =
                            `${remaining} pending`;
                    }

                    if (remaining === 0) {
                        reviewList.innerHTML = `
                            <div class="empty-review">
                                <i class="fa-solid fa-circle-check"></i>
                                <h3>You're all caught up</h3>
                                <p>
                                    There are no pending submissions
                                    for this task.
                                </p>
                            </div>
                        `;
                    }
                }, 220);
            }

        } catch (error) {
            console.error(
                "REVIEW ACTION ERROR:",
                error
            );

            window.alert(
                error.message ||
                "Something went wrong."
            );

            buttons?.forEach((item) => {
                item.disabled = false;
            });

            button.innerHTML = originalText;

        } finally {
            processing.delete(key);
        }
    }

    reviewList.addEventListener("click", (event) => {
        const button = event.target.closest(
            ".review-action-btn"
        );

        if (!button) {
            return;
        }

        const completionId = button.dataset.id;
        const action = button.dataset.action;

        reviewSubmission(
            completionId,
            action,
            button
        );
    });

    loadSubmissions();
});
