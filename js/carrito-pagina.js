// Solo en carrito.html: define el tipo (mayorista/minorista) desde la URL y actualiza enlaces y títulos
(function () {
  function getTipo() {
    var params = new URLSearchParams(window.location.search);
    var t = (params.get("tipo") || "").toLowerCase();
    return t === "mayorista" ? "mayorista" : "minorista";
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.body.classList.contains("carrito-page")) return;

    var tipo = getTipo();
    var volver = document.getElementById("carrito-volver-catalogo");
    var titulo = document.getElementById("carrito-titulo-pedido");
    var tagline = document.getElementById("carrito-tagline");
    var minNote = document.getElementById("carrito-min-note");

    if (volver) {
      volver.href = tipo === "mayorista" ? "mayorista.html" : "minorista.html";
    }
    if (titulo) {
      titulo.textContent = tipo === "mayorista" ? "Tu pedido mayorista" : "Tu pedido minorista";
    }
    if (tagline) {
      tagline.textContent = tipo === "mayorista" ? "Precios mayoristas" : "Precios minoristas";
    }
    if (minNote) {
      if (tipo === "mayorista") {
        minNote.classList.remove("is-hidden");
      } else {
        minNote.classList.add("is-hidden");
      }
    }
  });
})();
