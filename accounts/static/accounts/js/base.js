document.addEventListener("DOMContentLoaded", () => {

    const menuBtn =
        document.getElementById("menuBtn");

    const navMenu =
        document.getElementById("navMenu");

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const mobileDropdown =
        document.getElementById("mobileDropdown");


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


    function setDashboardMenu(open) {

        if (
            !mobileMenuBtn ||
            !mobileDropdown
        ) {
            return;
        }

        mobileDropdown.classList.toggle(
            "show",
            open
        );

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


    navMenu?.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest("a")
            ) {
                setPublicMenu(false);
            }
        }
    );


    mobileDropdown?.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest("a")
            ) {
                setDashboardMenu(false);
            }
        }
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                navMenu &&
                menuBtn &&
                navMenu.classList.contains(
                    "active"
                ) &&
                !navMenu.contains(
                    event.target
                ) &&
                !menuBtn.contains(
                    event.target
                )
            ) {
                setPublicMenu(false);
            }


            if (
                mobileDropdown &&
                mobileMenuBtn &&
                mobileDropdown.classList.contains(
                    "show"
                ) &&
                !mobileDropdown.contains(
                    event.target
                ) &&
                !mobileMenuBtn.contains(
                    event.target
                )
            ) {
                setDashboardMenu(false);
            }
        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key !== "Escape") {
                return;
            }

            setPublicMenu(false);
            setDashboardMenu(false);
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (window.innerWidth > 1050) {
                setPublicMenu(false);
            }

            if (window.innerWidth > 900) {
                setDashboardMenu(false);
            }
        }
    );

});
