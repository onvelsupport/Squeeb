document.addEventListener("DOMContentLoaded", () => {

    /* ======================================================
       PUBLIC MOBILE MENU
       ====================================================== */

    const menuBtn =
        document.getElementById("menuBtn");

    const navMenu =
        document.getElementById("navMenu");


    function setPublicMenu(open) {
        if (!menuBtn || !navMenu) {
            return;
        }

        navMenu.classList.toggle(
            "active",
            open
        );

        menuBtn.setAttribute(
            "aria-expanded",
            String(open)
        );

        const icon =
            menuBtn.querySelector("i");

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


    menuBtn?.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            const open =
                menuBtn.getAttribute(
                    "aria-expanded"
                ) !== "true";

            setPublicMenu(open);
        }
    );


    navMenu?.addEventListener(
        "click",
        (event) => {

            const link =
                event.target.closest("a");

            if (!link) {
                return;
            }

            setPublicMenu(false);
        }
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                !menuBtn ||
                !navMenu ||
                !navMenu.classList.contains(
                    "active"
                )
            ) {
                return;
            }

            if (
                navMenu.contains(event.target) ||
                menuBtn.contains(event.target)
            ) {
                return;
            }

            setPublicMenu(false);
        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                setPublicMenu(false);
                setDashboardMenu(false);
            }
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (
                window.innerWidth > 1050
            ) {
                setPublicMenu(false);
            }

            if (
                window.innerWidth > 900
            ) {
                setDashboardMenu(false);
            }
        }
    );


    /* ======================================================
       AUTHENTICATED MOBILE MENU FALLBACK
       ====================================================== */

    const mobileMenuBtn =
        document.getElementById(
            "mobileMenuBtn"
        );

    const mobileDropdown =
        document.getElementById(
            "mobileDropdown"
        );


    function setDashboardMenu(open) {

        if (
            !mobileMenuBtn ||
            !mobileDropdown
        ) {
            return;
        }

        mobileDropdown.hidden = !open;

        mobileDropdown.classList.toggle(
            "show",
            open
        );

        mobileMenuBtn.setAttribute(
            "aria-expanded",
            String(open)
        );

        const icon =
            mobileMenuBtn.querySelector(
                "i"
            );

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

            setDashboardMenu(open);
        }
    );


    mobileDropdown?.addEventListener(
        "click",
        (event) => {

            const link =
                event.target.closest("a");

            if (link) {
                setDashboardMenu(false);
            }
        }
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                !mobileMenuBtn ||
                !mobileDropdown ||
                mobileDropdown.hidden
            ) {
                return;
            }

            if (
                mobileDropdown.contains(
                    event.target
                ) ||
                mobileMenuBtn.contains(
                    event.target
                )
            ) {
                return;
            }

            setDashboardMenu(false);
        }
    );

});
