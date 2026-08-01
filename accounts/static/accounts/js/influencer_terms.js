document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("menuButton");
    const navigation = document.getElementById("navigation");
    const backToTop = document.getElementById("backToTop");
    const currentYear = document.getElementById("currentYear");

    const termsLinks = document.querySelectorAll(
        "#termsNavigation a"
    );

    const termsSections = document.querySelectorAll(
        ".terms-card[id]"
    );

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    if (menuButton && navigation) {
        menuButton.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");

            menuButton.classList.toggle("active", isOpen);
            menuButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            document.body.classList.toggle("menu-open", isOpen);
        });

        navigation.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navigation.classList.remove("open");
                menuButton.classList.remove("active");
                menuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );
                document.body.classList.remove("menu-open");
            });
        });
    }

    const updateBackToTopButton = () => {
        if (!backToTop) {
            return;
        }

        backToTop.classList.toggle(
            "visible",
            window.scrollY > 500
        );
    };

    window.addEventListener("scroll", updateBackToTopButton, {
        passive: true
    });

    updateBackToTopButton();

    if (backToTop) {
        backToTop.addEventListener("click", () => {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }

    const setActiveNavigationLink = () => {
        let currentSectionId = "";

        termsSections.forEach((section) => {
            const sectionTop =
                section.getBoundingClientRect().top;

            if (sectionTop <= 180) {
                currentSectionId = section.id;
            }
        });

        termsLinks.forEach((link) => {
            const linkTarget = link
                .getAttribute("href")
                .replace("#", "");

            link.classList.toggle(
                "active",
                linkTarget === currentSectionId
            );
        });
    };

    window.addEventListener(
        "scroll",
        setActiveNavigationLink,
        {
            passive: true
        }
    );

    setActiveNavigationLink();
});