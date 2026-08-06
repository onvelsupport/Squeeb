document.addEventListener("DOMContentLoaded", () => {

    const referralCode = document.getElementById("referralCode");
    const referralLink = document.getElementById("referralLink");
    const copyCodeBtn = document.getElementById("copyCodeBtn");
    const copyLinkBtn = document.getElementById("copyLinkBtn");
    const copyMsg = document.getElementById("copyMsg");

    const totalReferrals = document.getElementById("totalReferrals");
    const pendingReferrals = document.getElementById("pendingReferrals");
    const successfulReferrals = document.getElementById("successfulReferrals");
    const totalEarned = document.getElementById("totalEarned");
    const referralList = document.getElementById("referralList");
    const referralCount = document.getElementById("referralCount");

    let copyTimer = null;

    function money(value) {
        const amount = Number.parseFloat(value || 0);

        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
        }).format(Number.isFinite(amount) ? amount : 0);
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
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

    function showCopyMessage(message, isError = false) {
        if (!copyMsg) {
            return;
        }

        window.clearTimeout(copyTimer);

        copyMsg.textContent = message;
        copyMsg.style.color = isError ? "#b91c1c" : "";

        copyTimer = window.setTimeout(() => {
            copyMsg.textContent = "";
            copyMsg.style.color = "";
        }, 1800);
    }

    async function fallbackCopy(value) {
        const textarea = document.createElement("textarea");

        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);

        textarea.select();

        const copied = document.execCommand("copy");

        textarea.remove();

        return copied;
    }

    async function copyValue(value, message) {
        if (!value) {
            showCopyMessage(
                "Referral details are still loading.",
                true
            );
            return;
        }

        try {
            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {
                await navigator.clipboard.writeText(value);
            } else {
                const copied = await fallbackCopy(value);

                if (!copied) {
                    throw new Error("Copy failed");
                }
            }

            showCopyMessage(message);

        } catch (error) {
            console.error("REFERRAL COPY ERROR:", error);

            showCopyMessage(
                "Could not copy. Please copy manually.",
                true
            );
        }
    }

    function referralMarkup(referral) {
        const username = escapeHtml(
            referral.username || "user"
        );

        const createdAt = escapeHtml(
            referral.created_at || "Date unavailable"
        );

        const rewarded = Boolean(referral.rewarded);

        const status = rewarded
            ? "successful"
            : "pending";

        const statusText = rewarded
            ? "Rewarded"
            : "Pending";

        return `
            <article class="referral-item">

                <div class="referral-avatar">
                    <i class="fa-solid fa-user"></i>
                </div>

                <div class="referral-item-main">
                    <h3>@${username}</h3>
                    <p>
                        Joined on ${createdAt}
                    </p>
                </div>

                <span class="referral-status ${status}">
                    ${statusText}
                </span>

            </article>
        `;
    }

    async function loadReferrals() {
        try {
            const response = await fetch(
                "/api/referrals/",
                {
                    method: "GET",
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
                    "Could not load referrals."
                );
            }

            if (referralCode) {
                referralCode.value = data.code || "";
            }

            if (referralLink) {
                referralLink.value = data.link || "";
            }

            setText(
                totalReferrals,
                data.total_referrals || 0
            );

            setText(
                pendingReferrals,
                data.pending_referrals || 0
            );

            setText(
                successfulReferrals,
                data.successful_referrals || 0
            );

            setText(
                totalEarned,
                money(data.total_earned)
            );

            const referrals = Array.isArray(data.referrals)
                ? data.referrals
                : [];

            if (referralCount) {
                referralCount.textContent =
                    `${referrals.length} referral${referrals.length === 1 ? "" : "s"}`;
            }

            if (!referralList) {
                return;
            }

            if (!referrals.length) {
                referralList.innerHTML = `
                    <div class="referral-state">
                        <i class="fa-solid fa-user-plus"></i>
                        <h3>No referrals yet</h3>
                        <p>
                            Share your referral link to start
                            growing your referral network.
                        </p>
                    </div>
                `;
                return;
            }

            referralList.innerHTML = referrals
                .map(referralMarkup)
                .join("");

        } catch (error) {
            console.error(
                "REFERRAL LOAD ERROR:",
                error
            );

            if (referralCount) {
                referralCount.textContent = "Unavailable";
            }

            if (referralList) {
                referralList.innerHTML = `
                    <div class="referral-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Could not load referrals</h3>
                        <p>
                            ${escapeHtml(
                                error.message ||
                                "Please try again."
                            )}
                        </p>
                    </div>
                `;
            }
        }
    }

    copyCodeBtn?.addEventListener("click", () => {
        copyValue(
            referralCode?.value,
            "Referral code copied."
        );
    });

    copyLinkBtn?.addEventListener("click", () => {
        copyValue(
            referralLink?.value,
            "Referral link copied."
        );
    });

    loadReferrals();
});
