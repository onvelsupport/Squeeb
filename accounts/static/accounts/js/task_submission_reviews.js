document.addEventListener("DOMContentLoaded", () => {
    const reviewList = document.getElementById("reviewList");
    const taskId = window.TASK_ID;

    async function loadSubmissions() {
        try {
            const res = await fetch(`/api/my-tasks/${taskId}/reviews/`, {
                credentials: "include"
            });

            const data = await res.json();

            if (!res.ok) {
                reviewList.innerHTML = `
                    <div class="empty-review">
                        <h3>Could not load submissions</h3>
                        <p>${data.error || "Please try again."}</p>
                    </div>
                `;
                return;
            }

            if (!data.submissions || data.submissions.length === 0) {
                reviewList.innerHTML = `
                    <div class="empty-review">
                        <h3>No pending submissions</h3>
                        <p>When workers submit proof for this task, it will appear here.</p>
                    </div>
                `;
                return;
            }

            reviewList.innerHTML = data.submissions.map(item => `
                <div class="review-card">
                    <h3>@${item.worker}</h3>
                    <p><strong>Reward:</strong> £${item.reward}</p>
                    <p><strong>Submitted:</strong> ${item.submitted_at}</p>

                    ${
                        item.proof
                        ? `<a href="${item.proof}" target="_blank">
                                <img src="${item.proof}" class="proof-img" alt="Task proof">
                           </a>`
                        : `<p>No proof uploaded.</p>`
                    }

                    <div class="review-actions">
                        <button class="approve-btn" onclick="reviewSubmission(${item.id}, 'approve')">
                            Approve
                        </button>

                        <button class="reject-btn" onclick="reviewSubmission(${item.id}, 'reject')">
                            Reject
                        </button>
                    </div>
                </div>
            `).join("");

        } catch (error) {
            reviewList.innerHTML = `
                <div class="empty-review">
                    <h3>Network error</h3>
                    <p>Could not load task submissions.</p>
                </div>
            `;
        }
    }

    window.reviewSubmission = async function (completionId, action) {
        const confirmed = confirm(
            action === "approve"
                ? "Approve this proof and pay the worker?"
                : "Reject this proof?"
        );

        if (!confirmed) return;

        try {
            const res = await fetch(`/task-completions/${completionId}/${action}/`, {
                method: "POST",
                credentials: "include"
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Something went wrong.");
                return;
            }

            alert(data.message);
            loadSubmissions();

        } catch (error) {
            alert("Network error. Please try again.");
        }
    };

    loadSubmissions();
});