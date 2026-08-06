document.addEventListener("DOMContentLoaded", () => {

    const followBtn =
        document.getElementById("followBtn");

    const followBtnText =
        document.getElementById("followBtnText");

    const followBtnIcon =
        document.getElementById("followBtnIcon");

    const followersCount =
        document.getElementById("followersCount");


    function getCSRFToken() {
        const input =
            document.querySelector(
                "[name=csrfmiddlewaretoken]"
            );

        if (input?.value) {
            return input.value;
        }

        const cookies = document.cookie
            ? document.cookie.split(";")
            : [];

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (
                cookie.startsWith(
                    "csrftoken="
                )
            ) {
                return decodeURIComponent(
                    cookie.substring(
                        "csrftoken=".length
                    )
                );
            }
        }

        return "";
    }


    async function parseJson(response) {
        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            !contentType.includes(
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


    function updateFollowUI(
        isFollowing,
        followerTotal
    ) {
        if (!followBtn) {
            return;
        }

        followBtn.classList.toggle(
            "connected",
            Boolean(isFollowing)
        );

        followBtn.setAttribute(
            "aria-pressed",
            isFollowing
                ? "true"
                : "false"
        );

        if (followBtnText) {
            followBtnText.textContent =
                isFollowing
                    ? "Connected"
                    : "Connect";
        }

        if (followBtnIcon) {
            followBtnIcon.className =
                isFollowing
                    ? "fa-solid fa-user-check"
                    : "fa-solid fa-user-plus";
        }

        if (
            followersCount &&
            Number.isFinite(
                Number(followerTotal)
            )
        ) {
            followersCount.textContent =
                String(followerTotal);
        }
    }


    followBtn?.addEventListener(
        "click",
        async () => {

            const username =
                followBtn.dataset.username;

            if (!username) {
                return;
            }

            const originalHTML =
                followBtn.innerHTML;

            followBtn.disabled = true;

            followBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Updating...</span>
            `;

            try {
                const response = await fetch(
                    `/api/follow/${
                        encodeURIComponent(username)
                    }/`,
                    {
                        method: "POST",
                        credentials:
                            "same-origin",
                        headers: {
                            "Accept":
                                "application/json",

                            "X-CSRFToken":
                                getCSRFToken(),

                            "X-Requested-With":
                                "XMLHttpRequest",
                        },
                    }
                );

                const data =
                    await parseJson(response);

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        data.message ||
                        "Unable to update connection."
                    );
                }

                followBtn.innerHTML =
                    originalHTML;

                updateFollowUI(
                    Boolean(
                        data.is_following
                    ),
                    data.followers_count
                );

            } catch (error) {

                console.error(
                    "FOLLOW ERROR:",
                    error
                );

                followBtn.innerHTML =
                    originalHTML;

                window.alert(
                    error.message ||
                    "Something went wrong."
                );

            } finally {
                followBtn.disabled = false;
            }
        }
    );

});
