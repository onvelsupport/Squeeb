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

    const money = (value) => `£${parseFloat(value || 0).toFixed(2)}`;

    function setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    async function copyValue(value, message) {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);

            if (copyMsg) {
                copyMsg.textContent = message;

                setTimeout(() => {
                    copyMsg.textContent = "";
                }, 1800);
            }

        } catch (err) {
            if (copyMsg) {
                copyMsg.textContent = "Could not copy. Please copy manually.";
            }
        }
    }

    async function loadReferrals() {
        try {
            const response = await fetch("/api/referrals/", {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                if (referralList) {
                    referralList.innerHTML = `
                        <p class="error">Could not load referrals.</p>
                    `;
                }

                return;
            }

            const data = await response.json();

            if (referralCode) referralCode.value = data.code || "";
            if (referralLink) referralLink.value = data.link || "";

            setText(totalReferrals, data.total_referrals || 0);
            setText(pendingReferrals, data.pending_referrals || 0);
            setText(successfulReferrals, data.successful_referrals || 0);
            setText(totalEarned, money(data.total_earned));

            if (!data.referrals || data.referrals.length === 0) {
                referralList.innerHTML = `
                    <p class="empty">No referrals yet.</p>
                `;
                return;
            }

            referralList.innerHTML = data.referrals.map(referral => {
                const status = referral.rewarded ? "successful" : "pending";
                const statusText = referral.rewarded ? "Rewarded" : "Pending";

                return `
                    <div class="referral-item">
                        <div>
                            <h3>@${referral.username}</h3>
                            <p>Joined on ${referral.created_at}</p>
                        </div>

                        <span class="referral-status ${status}">
                            ${statusText}
                        </span>
                    </div>
                `;
            }).join("");

        } catch (error) {
            console.error("REFERRAL LOAD ERROR:", error);

            if (referralList) {
                referralList.innerHTML = `
                    <p class="error">Network error. Please try again.</p>
                `;
            }
        }
    }

    copyCodeBtn?.addEventListener("click", () => {
        copyValue(referralCode?.value, "Referral code copied.");
    });

    copyLinkBtn?.addEventListener("click", () => {
        copyValue(referralLink?.value, "Referral link copied.");
    });

    loadReferrals();

});