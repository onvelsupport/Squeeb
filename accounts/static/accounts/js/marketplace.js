document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileDropdown = document.getElementById("mobileDropdown");
    const mobileMenuClose = document.getElementById("mobileMenuClose");

    const searchInput = document.getElementById("globalSearchInput");
    const searchResults = document.getElementById("searchResults");


    /* ==========================================================
       MOBILE MENU
    ========================================================== */

    function openMobileMenu() {

        if (!mobileDropdown) {
            return;
        }

        mobileDropdown.classList.add("show");

        document.body.classList.add("menu-open");
    }


    function closeMobileMenu() {

        if (!mobileDropdown) {
            return;
        }

        mobileDropdown.classList.remove("show");

        document.body.classList.remove("menu-open");
    }


    mobileMenuBtn?.addEventListener("click", (event) => {

        event.stopPropagation();

        const isOpen =
            mobileDropdown?.classList.contains("show");

        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }

    });


    mobileMenuClose?.addEventListener(
        "click",
        closeMobileMenu
    );


    document.addEventListener("click", (event) => {

        if (
            mobileDropdown &&
            mobileMenuBtn &&
            !mobileDropdown.contains(event.target) &&
            !mobileMenuBtn.contains(event.target)
        ) {

            closeMobileMenu();

        }

    });


    window.addEventListener("resize", () => {

        if (window.innerWidth > 1060) {
            closeMobileMenu();
        }

    });


    /* ==========================================================
       PRODUCT CARD CLICK
    ========================================================== */

    document
        .querySelectorAll(".clickable-product")
        .forEach(card => {

            card.addEventListener("click", () => {

                const url = card.dataset.url;

                if (url) {
                    window.location.href = url;
                }

            });

        });


    /* ==========================================================
       PREVENT BUTTON CLICK FROM OPENING CARD
    ========================================================== */

    document
        .querySelectorAll(".stop-card-click")
        .forEach(element => {

            element.addEventListener("click", event => {

                event.stopPropagation();

            });

        });


    /* ==========================================================
       DELETE CONFIRMATION
    ========================================================== */

    document
        .querySelectorAll(".delete-product")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.stopPropagation();

                const confirmed = window.confirm(
                    "Are you sure you want to delete this product?"
                );

                if (!confirmed) {
                    event.preventDefault();
                }

            });

        });


    /* ==========================================================
       LOGOUT
    ========================================================== */

    async function logout(event) {

        event.preventDefault();

        try {

            await fetch("/api/logout/", {
                method: "POST",
                credentials: "same-origin"
            });

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

        window.location.href = "/login/";

    }


    document
        .querySelectorAll(".logout")
        .forEach(button => {

            button.addEventListener(
                "click",
                logout
            );

        });


    /* ==========================================================
       SEARCH DEBOUNCE
    ========================================================== */

    let searchTimeout = null;
    let activeSearchController = null;


    function hideSearchResults() {

        if (!searchResults) {
            return;
        }

        searchResults.style.display = "none";
        searchResults.innerHTML = "";

    }


    /* ==========================================================
       SAFE TEXT
    ========================================================== */

    function escapeHTML(value = "") {

        const div =
            document.createElement("div");

        div.textContent = value;

        return div.innerHTML;

    }


    /* ==========================================================
       GLOBAL SEARCH
    ========================================================== */

    async function performSearch(query) {

        if (!searchResults) {
            return;
        }


        if (activeSearchController) {

            activeSearchController.abort();

        }


        activeSearchController =
            new AbortController();


        try {

            const response = await fetch(
                `/api/search/?q=${encodeURIComponent(query)}`,
                {
                    credentials: "same-origin",
                    signal:
                        activeSearchController.signal
                }
            );


            if (!response.ok) {

                throw new Error(
                    `Search request failed: ${response.status}`
                );

            }


            const data =
                await response.json();


            searchResults.innerHTML = "";


            if (
                !data.results ||
                data.results.length === 0
            ) {

                searchResults.innerHTML = `
                    <div class="search-item">
                        No results found
                    </div>
                `;

                searchResults.style.display =
                    "block";

                return;

            }


            data.results.forEach(item => {

                const link =
                    document.createElement("a");

                link.href =
                    item.url || "#";

                link.className =
                    "search-item";


                link.innerHTML = `
                    <strong>
                        ${escapeHTML(item.name || "")}
                    </strong>

                    <div class="search-type">
                        ${escapeHTML(item.type || "")}
                    </div>
                `;


                searchResults.appendChild(
                    link
                );

            });


            searchResults.style.display =
                "block";


        } catch (error) {

            if (
                error.name !== "AbortError"
            ) {

                console.error(
                    "Search error:",
                    error
                );

            }

        }

    }


    searchInput?.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value.trim();


            clearTimeout(
                searchTimeout
            );


            if (!query) {

                hideSearchResults();

                return;

            }


            searchTimeout =
                setTimeout(
                    () => {

                        performSearch(
                            query
                        );

                    },
                    300
                );

        }
    );


    /* ==========================================================
       CLOSE SEARCH
    ========================================================== */

    document.addEventListener(
        "click",
        event => {

            if (
                searchResults &&
                searchInput &&
                !searchResults.contains(event.target) &&
                !searchInput.contains(event.target)
            ) {

                searchResults.style.display =
                    "none";

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
                event.key === "Escape"
            ) {

                closeMobileMenu();

                if (searchResults) {

                    searchResults.style.display =
                        "none";

                }

            }

        }
    );

});