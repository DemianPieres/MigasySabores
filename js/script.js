// Inicialización general: loader, año del footer, AOS, menú móvil y microanimaciones

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const mainContent = document.getElementById("mainContent");

  // Inicia AOS si está disponible
  if (window.AOS) {
    AOS.init({
      duration: 600,
      easing: "ease-out-quart",
      once: true,
      offset: 40
    });
  }

  // Animación de entrada y ocultar loader tras 2.3s aprox
  const LOADER_MS = 2300;

  if (loader && mainContent) {
    setTimeout(() => {
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(() => {
        loader.style.display = "none";
      }, 400);

      mainContent.classList.add("loaded");
    }, LOADER_MS);
  }

  // Ajustar año del footer
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  // Microanimación con GSAP para el personaje, si está disponible
  if (window.gsap) {
    const characters = document.querySelectorAll(".floating-character");
    characters.forEach((el, index) => {
      window.gsap.to(el, {
        y: -10,
        duration: 2.8 + index * 0.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });
  }
});

