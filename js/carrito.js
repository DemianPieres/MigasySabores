// Carrito de compras y envío por WhatsApp

const CARRITO_STORAGE_KEY = "migas_carrito";

const Carrito = (() => {
  let items = [];

  function cargar() {
    try {
      const guardado = localStorage.getItem(CARRITO_STORAGE_KEY);
      if (guardado) {
        const data = JSON.parse(guardado);
        if (Array.isArray(data.items)) {
          items = data.items;
        }
      }
    } catch (e) {
      console.warn("No se pudo leer el carrito desde localStorage.");
    }
  }

  function guardar() {
    localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify({ items }));
  }

  function obtenerItems() {
    return items;
  }

  function agregarItem({ id, nombre, tipoPrecio, precioUnitario, cantidad }) {
    if (!id || !nombre) return;
    if (!Number.isFinite(precioUnitario)) return;

    const existente = items.find(
      (i) => String(i.id) === String(id) && i.tipoPrecio === tipoPrecio
    );

    if (existente) {
      existente.cantidad += cantidad;
    } else {
      items.push({
        id,
        nombre,
        tipoPrecio,
        precioUnitario,
        cantidad
      });
    }
    guardar();
    renderizar();
  }

  function eliminarItem(index) {
    if (index < 0 || index >= items.length) return;
    items.splice(index, 1);
    guardar();
    renderizar();
  }

  function limpiar() {
    items = [];
    guardar();
    renderizar();
  }

  function total() {
    return items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
  }

  function cantidadProductos() {
    return items.length;
  }

  function actualizarBarraResumen() {
    const barra = document.getElementById("cart-floating-bar");
    const countSpan = document.getElementById("cart-floating-count");
    const totalSpanBar = document.getElementById("cart-floating-total");

    if (!barra || !countSpan || !totalSpanBar) return;

    if (!items.length) {
      barra.classList.add("is-hidden");
      return;
    }

    const cant = cantidadProductos();
    const totalValor = total();

    countSpan.textContent = `${cant} producto${cant !== 1 ? "s" : ""}`;
    totalSpanBar.textContent = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(totalValor);

    barra.classList.remove("is-hidden");
  }

  function renderizar() {
    const contenedor = document.getElementById("cart-items");
    const totalSpan = document.getElementById("cart-total");
    actualizarBarraResumen();
    if (!contenedor || !totalSpan) return;

    contenedor.innerHTML = "";

    if (!items.length) {
      const p = document.createElement("p");
      p.className = "cart-empty";
      p.textContent = "Todavía no agregaste productos.";
      contenedor.appendChild(p);
      totalSpan.textContent = "$0";
      actualizarBarraResumen();
      return;
    }

    items.forEach((item, index) => {
      const fila = document.createElement("div");
      fila.className = "cart-item-row";

      const main = document.createElement("div");
      main.className = "cart-item-main";

      const nombre = document.createElement("span");
      nombre.className = "cart-item-name";
      nombre.textContent = item.nombre;

      const meta = document.createElement("span");
      meta.className = "cart-item-meta";
      const tipoTexto = item.tipoPrecio === "mayorista" ? "Mayorista" : "Minorista";
      meta.textContent = `${tipoTexto} · $${item.precioUnitario}`;

      main.appendChild(nombre);
      main.appendChild(meta);

      const derecha = document.createElement("div");
      derecha.style.display = "flex";
      derecha.style.flexDirection = "column";
      derecha.style.alignItems = "flex-end";
      derecha.style.gap = "0.1rem";

      const qty = document.createElement("span");
      qty.className = "cart-item-qty";
      if (item.tipoPrecio === "mayorista") {
        const docenas = Math.round((item.cantidad / 12) * 2) / 2;
        const docenasStr = docenas % 1 === 0 ? String(docenas) : String(docenas);
        qty.textContent = `${docenasStr} doc. (${item.cantidad} u.)`;
      } else {
        qty.textContent = `${item.cantidad} u.`;
      }

      const btnEliminar = document.createElement("button");
      btnEliminar.type = "button";
      btnEliminar.className = "cart-item-remove";
      btnEliminar.textContent = "Quitar";
      btnEliminar.addEventListener("click", () => eliminarItem(index));

      derecha.appendChild(qty);
      derecha.appendChild(btnEliminar);

      fila.appendChild(main);
      fila.appendChild(derecha);

      contenedor.appendChild(fila);
    });

    const totalValor = total();
    totalSpan.textContent = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(totalValor);

    actualizarBarraResumen();
  }

  function armarMensajeWhatsApp({ nombre, telefono, comentario }) {
    if (!items.length) {
      return "";
    }
    const lineas = [];
    lineas.push("Hola! Quiero hacer el siguiente pedido:");
    lineas.push("");
    lineas.push(`Nombre: ${nombre}`);
    lineas.push(`Teléfono: ${telefono}`);
    lineas.push("");
    lineas.push("Pedido:");
    lineas.push("");

    items.forEach((item) => {
      if (item.tipoPrecio === "mayorista") {
        const docenas = Math.round((item.cantidad / 12) * 2) / 2;
        const docenasStr = docenas % 1 === 0 ? String(docenas) : String(docenas);
        lineas.push(
          `${docenasStr} doc. (${item.cantidad} u.) de ${item.nombre} (Mayorista, mínimo 1 docena)`
        );
      } else {
        lineas.push(`${item.cantidad}x ${item.nombre} (Minorista)`);
      }
    });

    const totalValor = total();
    lineas.push("");
    lineas.push(
      `Total: ${new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
      }).format(totalValor)}`
    );

    if (comentario) {
      lineas.push("");
      lineas.push("Comentario:");
      lineas.push(comentario);
    }

    lineas.push("");
    lineas.push("Gracias!");

    return lineas.join("\n");
  }

  return {
    cargar,
    guardar,
    obtenerItems,
    agregarItem,
    eliminarItem,
    limpiar,
    total,
    cantidadProductos,
    renderizar,
    armarMensajeWhatsApp
  };
})();

window.Carrito = Carrito;

// Inicialización en páginas que tienen carrito y formulario (carrito.html) o barra flotante (mayorista/minorista)
document.addEventListener("DOMContentLoaded", () => {
  const checkoutForm = document.getElementById("checkout-form");
  const cartSection = document.querySelector(".cart-section");
  const checkoutView = document.querySelector(".cart-form-wrapper");
  const confirmarBtn = document.getElementById("btn-confirmar-pedido");
  const verCarritoBtn = document.getElementById("cart-floating-button");
  const productList = document.getElementById("product-list");

  // En mayorista/minorista: "Ver mi carrito" lleva a la página del carrito
  if (verCarritoBtn && productList) {
    const tipo = (productList.getAttribute("data-tipo") || "minorista").toLowerCase();
    verCarritoBtn.addEventListener("click", () => {
      window.location.href = "carrito.html?tipo=" + (tipo === "mayorista" ? "mayorista" : "minorista");
    });
  }

  Carrito.cargar();
  Carrito.renderizar();

  if (!checkoutForm) return;

  if (checkoutView) {
    checkoutView.classList.add("is-hidden");
  }

  if (verCarritoBtn && cartSection) {
    verCarritoBtn.addEventListener("click", () => {
      cartSection.classList.remove("is-hidden");
      cartSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (confirmarBtn && checkoutView) {
    confirmarBtn.addEventListener("click", () => {
      checkoutView.classList.remove("is-hidden");
      checkoutForm.scrollIntoView({ behavior: "smooth" });
    });
  }

  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const items = Carrito.obtenerItems();
    if (!items.length) {
      alert("Primero agregá productos al pedido.");
      return;
    }

    const nombre = document.getElementById("nombre")?.value.trim() ?? "";
    const telefono = document.getElementById("telefono")?.value.trim() ?? "";
    const comentario = document.getElementById("comentario")?.value.trim() ?? "";

    if (!nombre || !telefono) {
      alert("Completá tu nombre y teléfono antes de enviar el pedido.");
      return;
    }

    const mensaje = Carrito.armarMensajeWhatsApp({ nombre, telefono, comentario });
    if (!mensaje) return;

    const telefonoDestino = "5493825663023";
    const url = `https://wa.me/${telefonoDestino}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");
  });
});

