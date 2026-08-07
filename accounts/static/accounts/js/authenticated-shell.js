document.addEventListener("DOMContentLoaded", () => {

    /*
     * ==========================================================
     * SHARED AUTHENTICATED SQUEEB SHELL
     * ==========================================================
     *
     * Handles:
     * - Mobile dashboard navigation
     * - Global search
     * - Notifications
     * - Global close behaviour
     */


    /* ==========================================================
       ELEMENTS
    ========================================================== */

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


    /* ==========================================================
       HELPERS
    ========================================================== */

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



    /* ==========================================================
       MOBILE DASHBOARD MENU
    ========================================================== */

    function setMobileMenu(open) {

        if (
            !mobileMenuBtn ||
            !mobileDropdown
        ) {

            return;

        }


        /*
         * IMPORTANT:
         *
         * base.html starts the menu with:
         *
         * hidden
         *
         * Some of the SQUEEB shell CSS also uses:
         *
         * .mobile-dropdown.show
         *
         * Therefore we handle BOTH.
         */

        if (open) {

            mobileDropdown.hidden =
                false;

            mobileDropdown.classList.add(
                "show"
            );

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                "true"
            );

        } else {

            mobileDropdown.classList.remove(
                "show"
            );

            mobileDropdown.hidden =
                true;

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                "false"
            );

        }


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


    /*
     * Make sure menu starts closed.
     */

    if (
        mobileMenuBtn &&
        mobileDropdown
    ) {

        setMobileMenu(false);

    }


    /*
     * Hamburger click
     */

    mobileMenuBtn?.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            const currentlyOpen =
                mobileMenuBtn.getAttribute(
                    "aria-expanded"
                ) === "true";


            setMobileMenu(
                !currentlyOpen
            );

        }
    );


    /*
     * Stop clicks inside dropdown from
     * immediately reaching document click.
     */

    mobileDropdown?.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            const link =
                event.target.closest("a");


            if (link) {

                setMobileMenu(false);

            }

        }
    );



    /* ==========================================================
       GLOBAL SEARCH
    ========================================================== */

    function closeSearchResults() {

        if (!searchResults) {

            return;

        }


        searchResults.hidden =
            true;

        searchResults.classList.remove(
            "show"
        );

        searchResults.innerHTML =
            "";


        searchInput?.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    function showSearchResults() {

        if (!searchResults) {

            return;

        }


        searchResults.hidden =
            false;

        searchResults.classList.add(
            "show"
        );


        searchInput?.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function searchIcon(type) {

        const value =
            String(
                type || ""
            ).toLowerCase();


        if (
            value === "user"
        ) {

            return "fa-user";

        }


        if (
            value === "product"
        ) {

            return "fa-bag-shopping";

        }


        if (
            value === "task"
        ) {

            return "fa-list-check";

        }


        if (
            value === "service"
        ) {

            return "fa-briefcase";

        }


        return "fa-magnifying-glass";
    }


    function renderSearchResults(results) {

        if (!searchResults) {

            return;

        }


        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {

            searchResults.innerHTML = `
                <div class="search-empty">
                    No results found.
                </div>
            `;


            showSearchResults();

            return;

        }


        searchResults.innerHTML =
            results
                .map(item => {

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
                        escapeHtml(
                            String(
                                item.url ||
                                "#"
                            )
                        );


                    const icon =
                        searchIcon(
                            item.type
                        );


                    return `
                        <a
                            href="${url}"
                            class="search-result-item"
                            role="option"
                        >

                            <span class="search-result-icon">
                                <i class="fa-solid ${icon}"></i>
                            </span>

                            <span class="search-result-copy">

                                <strong>
                                    ${name}
                                </strong>

                                <span>
                                    ${type}
                                </span>

                            </span>

                        </a>
                    `;

                })
                .join("");


        showSearchResults();

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
                <i class="fa-solid fa-spinner fa-spin"></i>
                Searching...
            </div>
        `;


        showSearchResults();


        try {

            const response =
                await fetch(
                    `/api/search/?q=${encodeURIComponent(query)}`,
                    {
                        credentials:
                            "same-origin",

                        headers: {
                            Accept:
                                "application/json"
                        },

                        signal:
                            searchController.signal
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Search unavailable."
                );

            }


            const data =
                await parseJson(
                    response
                );


            renderSearchResults(
                Array.isArray(
                    data.results
                )
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


            showSearchResults();

        }

    }


    searchInput?.addEventListener(
        "input",
        () => {

            const query =
                searchInput
                    .value
                    .trim();


            window.clearTimeout(
                searchTimer
            );


            if (
                query.length < 2
            ) {

                closeSearchResults();

                return;

            }


            searchTimer =
                window.setTimeout(
                    () => {

                        runSearch(
                            query
                        );

                    },
                    350
                );

        }
    );


    searchInput?.addEventListener(
        "focus",
        () => {

            const query =
                searchInput
                    .value
                    .trim();


            if (
                query.length >= 2 &&
                searchResults?.innerHTML.trim()
            ) {

                showSearchResults();

            }

        }
    );


    searchInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeSearchResults();

                searchInput.blur();

            }

        }
    );


    searchResults?.addEventListener(
        "click",
        event => {

            if (
                event.target.closest("a")
            ) {

                closeSearchResults();

            }

        }
    );



    /* ==========================================================
       NOTIFICATION COUNT
    ========================================================== */

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



    /* ==========================================================
       NOTIFICATION LINK
    ========================================================== */

    function notificationLink(value) {

        const link =
            String(
                value || ""
            ).trim();


        if (
            !link ||
            link
                .toLowerCase()
                .startsWith(
                    "javascript:"
                )
        ) {

            return "#";

        }


        return link;
    }



    /* ==========================================================
       RENDER NOTIFICATIONS
    ========================================================== */

    function renderNotifications(items) {

        if (!notificationList) {

            return;

        }


        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

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
            items
                .map(item => {

                    const title =
                        escapeHtml(
                            item.title ||
                            "Notification"
                        );


                    const message =
                        escapeHtml(
                            item.message ||
                            ""
                        );


                    const createdAt =
                        escapeHtml(
                            item.created_at ||
                            ""
                        );


                    const link =
                        escapeHtml(
                            notificationLink(
                                item.link
                            )
                        );


                    const unreadClass =
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
                            class="notification-item ${unreadClass}"
                        >

                            <span class="notification-icon">
                                <i class="fa-regular fa-bell"></i>
                            </span>

                            <span class="notification-copy">

                                <strong>
                                    ${title}
                                </strong>

                                <p>
                                    ${message}
                                </p>

                                <time>
                                    ${createdAt}
                                </time>

                            </span>

                            ${unreadDot}

                        </a>
                    `;

                })
                .join("");

    }



    /* ==========================================================
       LOAD NOTIFICATIONS
    ========================================================== */

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
                                        "application/json"
                                }
                            }
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Unable to load notifications."
                        );

                    }


                    const data =
                        await parseJson(
                            response
                        );


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


                    if (
                        notificationList
                    ) {

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



    /* ==========================================================
       MARK NOTIFICATIONS AS READ
    ========================================================== */

    async function markNotificationsRead() {

        try {

            const response =
                await fetch(
                    "/api/notifications/read/",
                    {
                        method:
                            "POST",

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
                                "XMLHttpRequest"
                        }
                    }
                );


            if (!response.ok) {

                return;

            }


            setNotificationCount(
                0
            );


            notificationList
                ?.querySelectorAll(
                    ".notification-item.unread"
                )
                .forEach(item => {

                    item.classList.remove(
                        "unread"
                    );


                    item
                        .querySelector(
                            ".notification-unread-dot"
                        )
                        ?.remove();

                });


        } catch (error) {

            console.error(
                "MARK NOTIFICATIONS READ ERROR:",
                error
            );

        }

    }



    /* ==========================================================
       NOTIFICATION PANEL
    ========================================================== */

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



    /* ==========================================================
       OPEN NOTIFICATIONS
    ========================================================== */

    openNotificationsBtn?.addEventListener(
        "click",
        async event => {

            event.preventDefault();
            event.stopPropagation();


            /*
             * Close other header UI first.
             */

            setMobileMenu(
                false
            );


            closeSearchResults();


            setNotificationPanel(
                true
            );


            await loadNotifications();


            if (
                notificationsLoaded
            ) {

                await markNotificationsRead();

            }

        }
    );



    /* ==========================================================
       CLOSE NOTIFICATIONS
    ========================================================== */

    closeNotificationsBtn?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            setNotificationPanel(
                false
            );

        }
    );


    notificationOverlay?.addEventListener(
        "click",
        () => {

            setNotificationPanel(
                false
            );

        }
    );



    /* ==========================================================
       NOTIFICATION ITEM CLICK
    ========================================================== */

    notificationList?.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    ".notification-item"
                );


            if (link) {

                setNotificationPanel(
                    false
                );

            }

        }
    );



    /* ==========================================================
       CLICK OUTSIDE
    ========================================================== */

    document.addEventListener(
        "click",
        event => {

            /*
             * Mobile menu
             */

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

                setMobileMenu(
                    false
                );

            }


            /*
             * Search
             */

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



    /* ==========================================================
       ESCAPE KEY
    ========================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {

                return;

            }


            setMobileMenu(
                false
            );


            closeSearchResults();


            setNotificationPanel(
                false
            );

        }
    );



    /* ==========================================================
       RESPONSIVE RESET
    ========================================================== */

    window.addEventListener(
        "resize",
        () => {

            /*
             * Desktop breakpoint.
             *
             * Closing here means that if someone opens
             * the mobile menu and then rotates/resizes,
             * it cannot remain stuck open.
             */

            if (
                window.innerWidth >
                1050
            ) {

                setMobileMenu(
                    false
                );

            }

        }
    );

});