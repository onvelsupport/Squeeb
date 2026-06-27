document.addEventListener("DOMContentLoaded", () => {
    const headings = document.querySelectorAll(".legal-card h2");

    headings.forEach((heading) => {
        heading.setAttribute("tabindex", "0");
    });
});