// Example: enable popup videos
$(document).ready(function () {
    $('.has-popup-video').magnificPopup({
        type: 'iframe'
    });
});

// GSAP fade-up animation
gsap.utils.toArray('.mil-up').forEach((el) => {
    gsap.from(el, {
        scrollTrigger: {
            trigger: el,
            start: "top 90%",
        },
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out"
    });
});
