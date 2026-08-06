document.addEventListener("DOMContentLoaded", () => {

    /*
     * Shared logged-in header functionality only.
     *
     * API shapes used by the current backend:
     * /api/search/?q=
     *   { results: [{ name, type, url }] }
     *
     * /api/notifications/
     *   { notifications: [...], unread_count: number }
     *
     * /api/notifications/read/
     *   POST -> { success: true }
     */

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const mobileDropdown =
        document.getElementById("mobileDropdown");

    const searchInput =
        document.getElementById("globalSearchInput");

    const searchResults =
        document.getElementById("searchResults");

    const openNotificationsBtn =
        document.getElementById("openNotifications");

    const closeNotificationsBtn =
        document.getElementById("closeNotifications");

    const notificationOverlay =
        document.getElementById("notificationOverlay");

    const notificationPanel =
        document.getElementById("notificationPanel");

    const notificationList =
        document.getElementById("notificationList");

    const notificationCount =
        document.getElementById("notificationCount");


    let searchTimer = null;
    let searchController = null;

    let notificationsLoaded = false;
    let notificationsPromise = null;


    function escapeHtml(value) {
        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    }


    function getCookie(name) {

        const cookies =
            document.cookie
                ? document.cookie.split(";")
                : [];

        for (let cookie of cookies) {

            cookie = cookie.trim();

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


    /* ======================================================
       LOGGED-IN MOBILE MENU
       ====================================================== */

    function setMobileMenu(open) {

        if (
            !mobileMenuBtn ||
            !mobileDropdown
        ) {
            return;
        }

        mobileDropdown.hidden = !open;

        mobileMenuBtn.setAttribute(
            "aria-expanded",
            String(open)
        );

        const icon =
            mobileMenuBtn.querySelector("i");

        if (icon) {

            icon.classList.toggle(
                "fa-bars",
                !open
            );

            icon.classList.toggle(
                "fa-xmark",
                open
            );
        }
    }


    mobileMenuBtn?.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            const open =
                mobileMenuBtn.getAttribute(
                    "aria-expanded"
                ) !== "true";

            setMobileMenu(open);
        }
    );


    mobileDropdown?.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest("a")
            ) {
                setMobileMenu(false);
            }
        }
    );


    /* ======================================================
       SEARCH
       ====================================================== */

    function closeSearchResults() {

        if (!searchResults) {
            return;
        }

        searchResults.hidden = true;
        searchResults.innerHTML = "";

        searchInput?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function searchIcon(type) {

        const value =
            String(type || "").toLowerCase();

        if (value === "user") {
            return "fa-user";
        }

        if (value === "product") {
            return "fa-bag-shopping";
        }

        if (value === "task") {
            return "fa-list-check";
        }

        return "fa-magnifying-glass";
    }


    function renderSearchResults(results) {

        if (!searchResults) {
            return;
        }

        if (!results.length) {

            searchResults.innerHTML = `
                <div class="search-empty">
                    No results found.
                </div>
            `;

            searchResults.hidden = false;

            searchInput?.setAttribute(
                "aria-expanded",
                "true"
            );

            return;
        }

        searchResults.innerHTML =
            results.map((item) => {

                const name =
                    escapeHtml(
                        item.name ||
                        "Result"
                    );

                const type =
                    escapeHtml(
                        item.type ||
                        "Result"
                    );

                const url =
                    String(
                        item.url || "#"
                    );

                const icon =
                    searchIcon(item.type);

                return `
                    <a
                        href="${escapeHtml(url)}"
                        class="search-result-item"
                        role="option"
                    >
                        <span class="search-result-icon">
                            <i class="fa-solid ${icon}"></i>
                        </span>

                        <span class="search-result-copy">
                            <strong>${name}</strong>
                            <span>${type}</span>
                        </span>
                    </a>
                `;
            }).join("");

        searchResults.hidden = false;

        searchInput?.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    async function runSearch(query) {

        if (
            !searchResults ||
            query.length < 2
        ) {
            closeSearchResults();
            return;
        }

        searchController?.abort();

        searchController =
            new AbortController();

        searchResults.innerHTML = `
            <div class="search-loading">
                Searching...
            </div>
        `;

        searchResults.hidden = false;

        try {

            const response = await fetch(
                `/api/search/?q=${
                    encodeURIComponent(query)
                }`,
                {
                    credentials:
                        "same-origin",

                    headers: {
                        Accept:
                            "application/json",
                    },

                    signal:
                        searchController.signal,
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Search unavailable."
                );
            }

            const data =
                await parseJson(response);

            renderSearchResults(
                Array.isArray(data.results)
                    ? data.results
                    : []
            );

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                return;
            }

            console.error(
                "GLOBAL SEARCH ERROR:",
                error
            );

            searchResults.innerHTML = `
                <div class="search-empty">
                    Search is temporarily unavailable.
                </div>
            `;

            searchResults.hidden = false;
        }
    }


    searchInput?.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value.trim();

            window.clearTimeout(
                searchTimer
            );

            if (query.length < 2) {
                closeSearchResults();
                return;
            }

            searchTimer =
                window.setTimeout(
                    () => runSearch(query),
                    350
                );
        }
    );


    searchInput?.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                closeSearchResults();
                searchInput.blur();
            }
        }
    );


    searchResults?.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest("a")
            ) {
                closeSearchResults();
            }
        }
    );


    /* ======================================================
       NOTIFICATIONS
       ====================================================== */

    function setNotificationCount(value) {

        if (!notificationCount) {
            return;
        }

        const count =
            Number.parseInt(
                value || 0,
                10
            ) || 0;

        notificationCount.textContent =
            String(count);

        notificationCount.hidden =
            count <= 0;
    }


    function notificationLink(value) {

        const link =
            String(value || "").trim();

        if (
            !link ||
            link.startsWith("javascript:")
        ) {
            return "#";
        }

        return link;
    }


    function renderNotifications(items) {

        if (!notificationList) {
            return;
        }

        if (!items.length) {

            notificationList.innerHTML = `
                <div class="empty-notification">
                    <i class="fa-regular fa-bell-slash"></i>

                    <p>
                        You do not have any notifications yet.
                    </p>
                </div>
            `;

            return;
        }

        notificationList.innerHTML =
            items.map((item) => {

                const title =
                    escapeHtml(
                        item.title ||
                        "Notification"
                    );

                const message =
                    escapeHtml(
                        item.message || ""
                    );

                const createdAt =
                    escapeHtml(
                        item.created_at || ""
                    );

                const link =
                    escapeHtml(
                        notificationLink(
                            item.link
                        )
                    );

                const unread =
                    item.is_read
                        ? ""
                        : "unread";

                const unreadDot =
                    item.is_read
                        ? ""
                        : `
                            <span
                                class="notification-unread-dot"
                                aria-hidden="true"
                            ></span>
                        `;

                return `
                    <a
                        href="${link}"
                        class="notification-item ${unread}"
                    >
                        <span class="notification-icon">
                            <i class="fa-regular fa-bell"></i>
                        </span>

                        <span class="notification-copy">
                            <strong>${title}</strong>
                            <p>${message}</p>
                            <time>${createdAt}</time>
                        </span>

                        ${unreadDot}
                    </a>
                `;
            }).join("");
    }


    async function loadNotifications(
        force = false
    ) {

        if (
            notificationsLoaded &&
            !force
        ) {
            return;
        }

        if (notificationsPromise) {
            return notificationsPromise;
        }

        if (notificationList) {

            notificationList.innerHTML = `
                <div class="notification-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>

                    <p>
                        Loading notifications...
                    </p>
                </div>
            `;
        }

        notificationsPromise =
            (async () => {

                try {

                    const response =
                        await fetch(
                            "/api/notifications/",
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
                            "Unable to load notifications."
                        );
                    }

                    const data =
                        await parseJson(response);

                    const items =
                        Array.isArray(
                            data.notifications
                        )
                            ? data.notifications
                            : [];

                    renderNotifications(
                        items
                    );

                    setNotificationCount(
                        data.unread_count
                    );

                    notificationsLoaded =
                        true;

                } catch (error) {

                    console.error(
                        "NOTIFICATION LOAD ERROR:",
                        error
                    );

                    if (notificationList) {

                        notificationList.innerHTML = `
                            <div class="notification-error">
                                <i class="fa-solid fa-triangle-exclamation"></i>

                                <p>
                                    Unable to load notifications.
                                    Please try again.
                                </p>
                            </div>
                        `;
                    }

                } finally {

                    notificationsPromise =
                        null;
                }
            })();

        return notificationsPromise;
    }


    async function markNotificationsRead() {

        try {

            const response = await fetch(
                "/api/notifications/read/",
                {
                    method: "POST",

                    credentials:
                        "same-origin",

                    headers: {
                        Accept:
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

            if (!response.ok) {
                return;
            }

            setNotificationCount(0);

            notificationList
                ?.querySelectorAll(
                    ".notification-item.unread"
                )
                .forEach((item) => {

                    item.classList.remove(
                        "unread"
                    );

                    item.querySelector(
                        ".notification-unread-dot"
                    )?.remove();
                });

        } catch (error) {

            console.error(
                "MARK NOTIFICATIONS READ ERROR:",
                error
            );
        }
    }


    function setNotificationPanel(open) {

        if (
            !notificationPanel ||
            !notificationOverlay
        ) {
            return;
        }

        notificationPanel.classList.toggle(
            "show",
            open
        );

        notificationPanel.setAttribute(
            "aria-hidden",
            String(!open)
        );

        notificationOverlay.hidden =
            !open;

        openNotificationsBtn?.setAttribute(
            "aria-expanded",
            String(open)
        );

        document.body.classList.toggle(
            "notification-open",
            open
        );
    }


    openNotificationsBtn?.addEventListener(
        "click",
        async () => {

            setMobileMenu(false);
            closeSearchResults();

            setNotificationPanel(true);

            await loadNotifications();

            /*
             * Mark as read only after the panel has successfully
             * had a chance to load the current notification list.
             */
            if (notificationsLoaded) {
                await markNotificationsRead();
            }
        }
    );


    closeNotificationsBtn?.addEventListener(
        "click",
        () => setNotificationPanel(false)
    );


    notificationOverlay?.addEventListener(
        "click",
        () => setNotificationPanel(false)
    );


    /* ======================================================
       GLOBAL CLOSE BEHAVIOUR
       ====================================================== */

    document.addEventListener(
        "click",
        (event) => {

            if (
                mobileMenuBtn &&
                mobileDropdown &&
                !mobileDropdown.hidden &&
                !mobileDropdown.contains(
                    event.target
                ) &&
                !mobileMenuBtn.contains(
                    event.target
                )
            ) {
                setMobileMenu(false);
            }


            if (
                searchInput &&
                searchResults &&
                !searchResults.hidden &&
                !searchResults.contains(
                    event.target
                ) &&
                !searchInput.contains(
                    event.target
                )
            ) {
                closeSearchResults();
            }
        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key !== "Escape") {
                return;
            }

            setMobileMenu(false);
            closeSearchResults();
            setNotificationPanel(false);
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (window.innerWidth > 1050) {
                setMobileMenu(false);
            }
        }
    );

});
