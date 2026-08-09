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

    document.documentElement.classList.add("squeeb-native-app");
    document.documentElement.dataset.squeebApp = "true";

    function setActiveTab() {
        const path = window.location.pathname.replace(/\/+$/, "") || "/";
        const tabs = document.querySelectorAll(".app-bottom-nav [data-app-nav]");
        if (!tabs.length) return;

        let active = "home";
        if (path.startsWith("/earnings")) active = "earn";
        else if (path.startsWith("/my-tasks") || path.includes("task")) active = "advertise";
        else if (path.startsWith("/market")) active = "market";
        else if (path.startsWith("/more") || path.startsWith("/withdrawals") || path.startsWith("/referrals") || path.startsWith("/transaction")) active = "more";

        tabs.forEach(tab => {
            const on = tab.dataset.appNav === active;
            tab.classList.toggle("active", on);
            if (on) tab.setAttribute("aria-current", "page");
            else tab.removeAttribute("aria-current");
        });
    }

    setActiveTab();

    // Mark external destinations so Capacitor/Android can hand them to an external app/browser.
    document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link) return;

        let url;
        try { url = new URL(link.href, window.location.href); }
        catch (_) { return; }

        if (url.protocol === "mailto:" || url.protocol === "tel:") {
            link.setAttribute("target", "_blank");
            return;
        }

        if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== window.location.hostname) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
        }
    }, true);
})();
