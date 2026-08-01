document.addEventListener("DOMContentLoaded", function () {
    const backToTop = document.getElementById("termsBackToTop");
    const navigationLinks = document.querySelectorAll(
        "#termsNavigation a"
    );
    const sections = document.querySelectorAll(
        ".terms-card[id]"
    );

    function updateBackToTopButton() {
        if (!backToTop) {
            return;
        }

        backToTop.classList.toggle(
            "visible",
            window.scrollY > 450
        );
    }

    function updateActiveNavigationLink() {
        let currentSection = "";

        sections.forEach(function (section) {
            const sectionTop =
                section.getBoundingClientRect().top;

            if (sectionTop <= 180) {
                currentSection = section.id;
            }
        });

        navigationLinks.forEach(function (link) {
            const target = link
                .getAttribute("href")
                .replace("#", "");

            link.classList.toggle(
                "active",
                target === currentSection
            );
        });
    }

    if (backToTop) {
        backToTop.addEventListener("click", function () {
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        });
    }

    window.addEventListener(
        "scroll",
        function () {
            updateBackToTopButton();
            updateActiveNavigationLink();
        },
        { passive: true }
    );

    updateBackToTopButton();
    updateActiveNavigationLink();
});
