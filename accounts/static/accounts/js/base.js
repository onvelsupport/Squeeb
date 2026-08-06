document.addEventListener("DOMContentLoaded", () => {

    /*
     * base.js only controls the logged-out/public navigation.
     * Logged-in header functionality lives in authenticated-shell.js.
     */

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

            if (event.target.closest("a")) {
                setPublicMenu(false);
            }
        }
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                !menuBtn ||
                !navMenu ||
                !navMenu.classList.contains("active")
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
            }
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (window.innerWidth > 1050) {
                setPublicMenu(false);
            }
        }
    );

});
