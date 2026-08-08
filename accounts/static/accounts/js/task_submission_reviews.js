document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const reviewPage =
        document.getElementById("reviewPage");

    const reviewList =
        document.getElementById("reviewList");

    const reviewCount =
        document.getElementById("reviewCount");

    const reviewSectionTitle =
        document.getElementById("reviewSectionTitle");

    const approveAllBtn =
        document.getElementById("approveAllBtn");

    const reviewTabs =
        document.querySelectorAll(".review-tab");

    const pendingTabCount =
        document.getElementById("pendingTabCount");

    const approvedTabCount =
        document.getElementById("approvedTabCount");

    const rejectedTabCount =
        document.getElementById("rejectedTabCount");


    if (
        !reviewPage ||
        !reviewList
    ) {
        return;
    }


    const taskId =
        reviewPage.dataset.taskId;


    let currentStatus =
        "pending";


    let loadPromise =
        null;


    let approvingAll =
        false;


    const processing =
        new Set();


    /* ==========================================================
       CSRF COOKIE
    ========================================================== */

    function getCookie(name) {

        const cookies =
            document.cookie
                ? document.cookie.split(";")
                : [];


        for (let cookie of cookies) {

            cookie =
                cookie.trim();


            if (
                cookie.startsWith(
                    `${name}=`
                )
            ) {

                return decodeURIComponent(
                    cookie.substring(
                        name.length + 1
                    )
                );

            }

        }


        return "";

    }


    /* ==========================================================
       HTML ESCAPE
    ========================================================== */

    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    /* ==========================================================
       MONEY
    ========================================================== */

    function money(value) {

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

    }


    /* ==========================================================
       MEDIA URL
    ========================================================== */

    function safeMediaUrl(value) {

        if (!value) {
            return "";
        }


        try {

            const url =
                new URL(
                    value,
                    window.location.origin
                );


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


        } catch {

            return "";

        }

    }


    /* ==========================================================
       PARSE JSON
    ========================================================== */

    async function parseJson(response) {

        const type =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            !type.includes(
                "application/json"
            )
        ) {

            return {};

        }


        try {

            return await response.json();

        } catch {

            return {};

        }

    }


    /* ==========================================================
       UPDATE TAB COUNTS
    ========================================================== */

    function updateTabCounts(counts = {}) {

        if (pendingTabCount) {

            pendingTabCount.textContent =
                Number(
                    counts.pending || 0
                );

        }


        if (approvedTabCount) {

            approvedTabCount.textContent =
                Number(
                    counts.approved || 0
                );

        }


        if (rejectedTabCount) {

            rejectedTabCount.textContent =
                Number(
                    counts.rejected || 0
                );

        }

    }


    /* ==========================================================
       SECTION TITLE
    ========================================================== */

    function updateSectionTitle() {

        if (!reviewSectionTitle) {
            return;
        }


        if (
            currentStatus === "approved"
        ) {

            reviewSectionTitle.textContent =
                "Approved submissions";

            return;

        }


        if (
            currentStatus === "rejected"
        ) {

            reviewSectionTitle.textContent =
                "Rejected submissions";

            return;

        }


        reviewSectionTitle.textContent =
            "Proof awaiting review";

    }


    /* ==========================================================
       EMPTY STATE
    ========================================================== */

    function showEmptyState() {

        let title =
            "No pending submissions";


        let message =
            "New worker proof will appear here when it is submitted.";


        let icon =
            "fa-circle-check";


        if (
            currentStatus === "approved"
        ) {

            title =
                "No approved submissions";

            message =
                "Submissions you approve will appear here.";

            icon =
                "fa-check-double";

        }


        if (
            currentStatus === "rejected"
        ) {

            title =
                "No rejected submissions";

            message =
                "Submissions you reject will appear here.";

            icon =
                "fa-ban";

        }


        reviewList.innerHTML = `
            <div class="empty-review">

                <i
                    class="fa-solid ${icon}"
                ></i>

                <h3>
                    ${title}
                </h3>

                <p>
                    ${message}
                </p>

            </div>
        `;


        if (
            currentStatus === "pending" &&
            approveAllBtn
        ) {

            approveAllBtn.hidden =
                true;

        }

    }


    /* ==========================================================
       UPDATE APPROVE ALL BUTTON
    ========================================================== */

    function updateApproveAllButton() {

        if (!approveAllBtn) {
            return;
        }


        if (
            currentStatus !== "pending"
        ) {

            approveAllBtn.hidden =
                true;

            return;

        }


        const cards =
            reviewList.querySelectorAll(
                ".review-card"
            );


        if (
            cards.length === 0
        ) {

            approveAllBtn.hidden =
                true;

            return;

        }


        approveAllBtn.hidden =
            false;


        approveAllBtn.disabled =
            approvingAll;


        if (!approvingAll) {

            approveAllBtn.innerHTML = `
                <i class="fa-solid fa-check-double"></i>

                <span>
                    Approve All (${cards.length})
                </span>
            `;

        }

    }


    /* ==========================================================
       PROOF MARKUP
    ========================================================== */

    function getProofMarkup(
        proofUrl,
        worker
    ) {

        if (!proofUrl) {

            return `
                <div class="proof-card no-proof">
                    No proof uploaded.
                </div>
            `;

        }


        return `
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

                    <span>
                        Screenshot proof
                    </span>

                    <span>

                        <i
                            class="fa-solid fa-up-right-from-square"
                        ></i>

                        Open

                    </span>

                </div>

            </div>
        `;

    }


    /* ==========================================================
       PENDING ACTIONS
    ========================================================== */

    function pendingActions(id) {

        return `
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
        `;

    }


    /* ==========================================================
       REVIEWED RESULT
    ========================================================== */

    function reviewedResult(
        status,
        reviewedAt
    ) {

        const safeDate =
            escapeHtml(
                reviewedAt ||
                "Review date unavailable"
            );


        if (
            status === "approved"
        ) {

            return `
                <div class="review-result approved">

                    <div class="review-result-left">

                        <i
                            class="fa-solid fa-circle-check"
                        ></i>

                        Approved

                    </div>

                    <small>
                        ${safeDate}
                    </small>

                </div>
            `;

        }


        return `
            <div class="review-result rejected">

                <div class="review-result-left">

                    <i
                        class="fa-solid fa-circle-xmark"
                    ></i>

                    Rejected

                </div>

                <small>
                    ${safeDate}
                </small>

            </div>
        `;

    }


    /* ==========================================================
       SUBMISSION CARD
    ========================================================== */

    function submissionCard(item) {

        const id =
            Number.parseInt(
                item.id,
                10
            );


        const worker =
            escapeHtml(
                item.worker ||
                "worker"
            );


        const submittedAt =
            escapeHtml(
                item.submitted_at ||
                "Date unavailable"
            );


        const status =
            String(
                item.status ||
                currentStatus ||
                "pending"
            ).toLowerCase();


        const reviewedAt =
            item.reviewed_at ||
            "";


        const proofUrl =
            safeMediaUrl(
                item.proof
            );


        const proofMarkup =
            getProofMarkup(
                proofUrl,
                worker
            );


        let cardClass =
            "";


        if (
            status === "approved"
        ) {

            cardClass =
                "approved-card";

        }


        if (
            status === "rejected"
        ) {

            cardClass =
                "rejected-card";

        }


        const statusText =
            status === "pending"
                ? "Pending review"
                : status === "approved"
                    ? "Approved"
                    : "Rejected";


        const statusIcon =
            status === "pending"
                ? "fa-clock"
                : status === "approved"
                    ? "fa-circle-check"
                    : "fa-circle-xmark";


        const actionMarkup =
            status === "pending"
                ? pendingActions(id)
                : reviewedResult(
                    status,
                    reviewedAt
                );


        return `
            <article
                class="review-card ${cardClass}"
                data-completion-id="${id}"
            >

                <div class="review-main">

                    <div class="review-top-row">

                        <div class="review-worker">

                            <div class="review-worker-avatar">

                                <i
                                    class="fa-solid fa-user"
                                ></i>

                            </div>


                            <div>

                                <strong>
                                    @${worker}
                                </strong>

                                <small>
                                    Worker submission
                                </small>

                            </div>

                        </div>


                        <div class="review-reward">

                            <span>
                                Reward
                            </span>

                            <strong>
                                ${money(item.reward)}
                            </strong>

                        </div>

                    </div>


                    <div class="review-meta">

                        <span>

                            <i
                                class="fa-solid fa-calendar"
                            ></i>

                            ${submittedAt}

                        </span>


                        <span>

                            <i
                                class="fa-solid ${statusIcon}"
                            ></i>

                            ${statusText}

                        </span>

                    </div>


                    ${actionMarkup}

                </div>


                ${proofMarkup}

            </article>
        `;

    }


    /* ==========================================================
       LOADING STATE
    ========================================================== */

    function showLoadingState() {

        reviewList.innerHTML = `
            <div class="empty-review">

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                <h3>
                    Loading submissions
                </h3>

                <p>
                    Please wait while we load this review history.
                </p>

            </div>
        `;

    }


    /* ==========================================================
       LOAD SUBMISSIONS
    ========================================================== */

    async function loadSubmissions() {

        if (loadPromise) {

            return loadPromise;

        }


        showLoadingState();


        updateSectionTitle();


        if (approveAllBtn) {

            approveAllBtn.hidden =
                true;

        }


        loadPromise =
            (async () => {

                try {

                    const url =
                        `/api/my-tasks/${
                            encodeURIComponent(
                                taskId
                            )
                        }/reviews/?status=${
                            encodeURIComponent(
                                currentStatus
                            )
                        }`;


                    const response =
                        await fetch(
                            url,
                            {
                                credentials:
                                    "same-origin",

                                headers: {
                                    Accept:
                                        "application/json",
                                },
                            }
                        );


                    const data =
                        await parseJson(
                            response
                        );


                    if (!response.ok) {

                        throw new Error(
                            data.error ||
                            "Could not load submissions."
                        );

                    }


                    const submissions =
                        Array.isArray(
                            data.submissions
                        )
                            ? data.submissions
                            : [];


                    updateTabCounts(
                        data.counts || {}
                    );


                    if (reviewCount) {

                        reviewCount.textContent =
                            `${submissions.length} ${currentStatus}`;

                    }


                    if (
                        submissions.length === 0
                    ) {

                        showEmptyState();

                        return;

                    }


                    reviewList.innerHTML =
                        submissions
                            .map(
                                submissionCard
                            )
                            .join("");


                    updateApproveAllButton();


                } catch (error) {

                    console.error(
                        "REVIEW LOAD ERROR:",
                        error
                    );


                    if (reviewCount) {

                        reviewCount.textContent =
                            "Unavailable";

                    }


                    if (approveAllBtn) {

                        approveAllBtn.hidden =
                            true;

                    }


                    reviewList.innerHTML = `
                        <div class="empty-review">

                            <i
                                class="fa-solid fa-triangle-exclamation"
                            ></i>

                            <h3>
                                Could not load submissions
                            </h3>

                            <p>
                                ${
                                    escapeHtml(
                                        error.message ||
                                        "Please try again."
                                    )
                                }
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
       SEND REVIEW REQUEST
    ========================================================== */

    async function sendReviewRequest(
        completionId,
        action
    ) {

        const response =
            await fetch(
                `/task-completions/${
                    encodeURIComponent(
                        completionId
                    )
                }/${action}/`,
                {
                    method:
                        "POST",

                    credentials:
                        "same-origin",

                    headers: {

                        "Accept":
                            "application/json",

                        "X-CSRFToken":
                            getCookie(
                                "csrftoken"
                            ),

                        "X-Requested-With":
                            "XMLHttpRequest",

                    },
                }
            );


        const data =
            await parseJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "Something went wrong."
            );

        }


        return data;

    }


    /* ==========================================================
       INDIVIDUAL APPROVE / REJECT
    ========================================================== */

    async function reviewSubmission(
        completionId,
        action,
        button
    ) {

        if (
            currentStatus !== "pending"
        ) {

            return;

        }


        const key =
            `${completionId}:${action}`;


        if (
            processing.has(key) ||
            approvingAll
        ) {

            return;

        }


        const approving =
            action === "approve";


        const confirmed =
            window.confirm(
                approving
                    ? "Approve this proof and credit the worker?"
                    : "Reject this proof?"
            );


        if (!confirmed) {

            return;

        }


        processing.add(
            key
        );


        const card =
            button.closest(
                ".review-card"
            );


        const buttons =
            card?.querySelectorAll(
                ".review-action-btn"
            );


        buttons?.forEach(
            item => {

                item.disabled =
                    true;

            }
        );


        const originalText =
            button.innerHTML;


        button.innerHTML =
            approving
                ? `
                    <i
                        class="fa-solid fa-spinner fa-spin"
                    ></i>

                    Approving
                `
                : `
                    <i
                        class="fa-solid fa-spinner fa-spin"
                    ></i>

                    Rejecting
                `;


        try {

            await sendReviewRequest(
                completionId,
                action
            );


            if (card) {

                card.style.opacity =
                    ".35";


                card.style.pointerEvents =
                    "none";


                window.setTimeout(
                    async () => {

                        card.remove();


                        await loadSubmissions();

                    },
                    180
                );

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


            buttons?.forEach(
                item => {

                    item.disabled =
                        false;

                }
            );


            button.innerHTML =
                originalText;


        } finally {

            processing.delete(
                key
            );

        }

    }


    /* ==========================================================
       APPROVE ALL
    ========================================================== */

    async function approveAllSubmissions() {

        if (
            approvingAll ||
            !approveAllBtn ||
            currentStatus !== "pending"
        ) {

            return;

        }


        const cards =
            Array.from(
                reviewList.querySelectorAll(
                    ".review-card"
                )
            );


        if (!cards.length) {

            return;

        }


        const confirmed =
            window.confirm(
                `Approve all ${cards.length} pending submissions?\n\n` +
                "Each approved worker will receive their reward."
            );


        if (!confirmed) {

            return;

        }


        approvingAll =
            true;


        approveAllBtn.disabled =
            true;


        reviewList
            .querySelectorAll(
                ".review-action-btn"
            )
            .forEach(
                button => {

                    button.disabled =
                        true;

                }
            );


        let approvedCount =
            0;


        let failedCount =
            0;


        for (
            let index = 0;
            index < cards.length;
            index += 1
        ) {

            const card =
                cards[index];


            const completionId =
                card.dataset.completionId;


            approveAllBtn.innerHTML = `
                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                <span>
                    Approving ${index + 1}/${cards.length}
                </span>
            `;


            if (!completionId) {

                failedCount += 1;

                continue;

            }


            card.classList.add(
                "approving-all"
            );


            try {

                await sendReviewRequest(
                    completionId,
                    "approve"
                );


                approvedCount += 1;


                card.remove();


            } catch (error) {

                failedCount += 1;


                console.error(
                    "APPROVE ALL ERROR:",
                    completionId,
                    error
                );


                card.classList.remove(
                    "approving-all"
                );

            }

        }


        approvingAll =
            false;


        approveAllBtn.disabled =
            false;


        await loadSubmissions();


        if (
            failedCount > 0
        ) {

            window.alert(
                `${approvedCount} approved. ` +
                `${failedCount} could not be approved.`
            );

        }

    }


    /* ==========================================================
       TAB CLICK
    ========================================================== */

    reviewTabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    const status =
                        tab.dataset.status;


                    if (
                        !status ||
                        status === currentStatus ||
                        approvingAll
                    ) {

                        return;

                    }


                    currentStatus =
                        status;


                    reviewTabs.forEach(
                        item => {

                            const active =
                                item === tab;


                            item.classList.toggle(
                                "active",
                                active
                            );


                            item.setAttribute(
                                "aria-selected",
                                active
                                    ? "true"
                                    : "false"
                            );

                        }
                    );


                    loadSubmissions();

                }
            );

        }
    );


    /* ==========================================================
       INDIVIDUAL ACTION CLICK
    ========================================================== */

    reviewList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".review-action-btn"
                );


            if (!button) {

                return;

            }


            const completionId =
                button.dataset.id;


            const action =
                button.dataset.action;


            if (
                !completionId ||
                !action
            ) {

                return;

            }


            reviewSubmission(
                completionId,
                action,
                button
            );

        }
    );


    /* ==========================================================
       APPROVE ALL CLICK
    ========================================================== */

    approveAllBtn?.addEventListener(
        "click",
        approveAllSubmissions
    );


    /* ==========================================================
       INITIAL LOAD
    ========================================================== */

    loadSubmissions();

});