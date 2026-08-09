(() => {
    function isNativeSqueebApp() {
        try {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function") {
                return window.Capacitor.isNativePlatform();
            }
        } catch (_) {}

        const ua = navigator.userAgent || "";
        return /;\s*wv\)/i.test(ua) || /\bwv\b/i.test(ua) || /SQUEEBApp/i.test(ua);
    }

    if (!isNativeSqueebApp()) return;

    const root = document.documentElement;
    root.classList.add("squeeb-native-app");
    root.dataset.squeebApp = "true";

    function unlockPage() {
        root.style.overflowX = "hidden";
        root.style.overflowY = "auto";
        root.style.height = "auto";
        root.style.touchAction = "pan-y";

        if (!document.body) return;

        document.body.classList.remove("modal-open", "menu-open", "nav-open", "no-scroll", "overflow-hidden");
        document.body.style.overflowX = "hidden";
        document.body.style.overflowY = "auto";
        document.body.style.height = "auto";
        document.body.style.position = "static";
        document.body.style.touchAction = "pan-y";

        // Clear overlays only when they are not actually open.
        document.querySelectorAll(
            ".modal-overlay, .notification-overlay, .mobile-menu-overlay, .drawer-overlay, .overlay"
        ).forEach((overlay) => {
            const isOpen =
                overlay.classList.contains("show") ||
                overlay.classList.contains("active") ||
                overlay.getAttribute("aria-hidden") === "false" ||
                overlay.hidden === false && getComputedStyle(overlay).display !== "none";

            if (!isOpen) {
                overlay.style.pointerEvents = "none";
            }
        });
    }

    function setActiveTab() {
        const path = window.location.pathname.replace(/\/+$/, "") || "/";
        const tabs = document.querySelectorAll(".app-bottom-nav [data-app-nav]");
        if (!tabs.length) return;

        let active = "home";

        if (path.startsWith("/earnings")) {
            active = "earn";
        } else if (
            path.startsWith("/my-tasks") ||
            path.startsWith("/create-task") ||
            path.includes("task")
        ) {
            active = "advertise";
        } else if (path.startsWith("/market")) {
            active = "market";
        } else if (
            path.startsWith("/more") ||
            path.startsWith("/withdrawals") ||
            path.startsWith("/referrals") ||
            path.startsWith("/transaction") ||
            path.startsWith("/settings") ||
            path.startsWith("/profile")
        ) {
            active = "more";
        }

        tabs.forEach((tab) => {
            const isActive = tab.dataset.appNav === active;
            tab.classList.toggle("active", isActive);

            if (isActive) {
                tab.setAttribute("aria-current", "page");
            } else {
                tab.removeAttribute("aria-current");
            }
        });
    }

    function enableBottomNavigation() {
        const nav = document.querySelector(".app-bottom-nav");
        if (!nav) return;

        nav.style.pointerEvents = "auto";

        nav.querySelectorAll("a[href]").forEach((link) => {
            link.style.pointerEvents = "auto";
            link.style.touchAction = "manipulation";

            // Use normal navigation but explicitly recover if another script blocks it.
            link.addEventListener("click", (event) => {
                const href = link.getAttribute("href");
                if (!href || href === "#") return;

                if (event.defaultPrevented) {
                    window.location.assign(href);
                }
            });
        });
    }

    function configureExternalLinks() {
        document.addEventListener(
            "click",
            (event) => {
                const link = event.target.closest("a[href]");
                if (!link) return;

                let url;
                try {
                    url = new URL(link.href, window.location.href);
                } catch (_) {
                    return;
                }

                if (url.protocol === "mailto:" || url.protocol === "tel:") {
                    link.setAttribute("target", "_blank");
                    return;
                }

                if (
                    (url.protocol === "http:" || url.protocol === "https:") &&
                    url.hostname !== window.location.hostname
                ) {
                    link.setAttribute("target", "_blank");
                    link.setAttribute("rel", "noopener noreferrer");
                }
            },
            true
        );
    }

    function observeLocks() {
        if (!document.body || typeof MutationObserver === "undefined") return;

        const observer = new MutationObserver(() => {
            const hasVisibleModal = document.querySelector(
                ".modal.show, .modal.active, .notification-panel.show, .notification-panel.active, [role='dialog'][aria-hidden='false']"
            );

            if (!hasVisibleModal) {
                document.body.classList.remove("modal-open", "no-scroll", "overflow-hidden");
                document.body.style.overflowY = "auto";
                document.body.style.position = "static";
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class", "style"],
            subtree: false,
        });
    }

    function init() {
        unlockPage();
        setActiveTab();
        enableBottomNavigation();
        configureExternalLinks();
        observeLocks();

        window.addEventListener("pageshow", () => {
            unlockPage();
            setActiveTab();
        });

        window.addEventListener("focus", unlockPage);

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) unlockPage();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
