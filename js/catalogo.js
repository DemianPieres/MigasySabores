/**
 * Catálogo: los productos se obtienen ÚNICAMENTE de la API (base de datos).
 * Se usa siempre el mismo origen donde está sirviendo el backend (Render, localhost, etc.).
 */

var API_PRODUCTOS = window.location.origin + "/api/productos";

const Catalogo = (() => {
  let cacheProductos = null;

  function invalidarCache() {
    cacheProductos = null;
  }

  /**
   * Obtiene productos solo desde la API. Si la API falla, devuelve [].
   * forceRefresh: si true, ignora la caché y vuelve a pedir a la API.
   */
  async function obtenerProductos(forceRefresh = false) {
    if (!forceRefresh && cacheProductos !== null) {
      return cacheProductos;
    }
    try {
      const respuesta = await fetch(API_PRODUCTOS, { cache: "no-cache" });
      if (!respuesta.ok) return [];
      const data = await respuesta.json();
      const productos = Array.isArray(data.productos) ? data.productos : [];
      cacheProductos = productos;
      return productos;
    } catch (err) {
      console.warn("Catálogo: no se pudo cargar desde la API.", err);
      cacheProductos = [];
      return [];
    }
  }

  function buscarPorId(id) {
    if (!cacheProductos) return null;
    return cacheProductos.find((p) => String(p.id) === String(id)) || null;
  }

  // Renderizado para páginas mayorista/minorista
  async function renderizarParaVenta(tipoPagina) {
    const contenedor = document.getElementById("product-list");
    if (!contenedor) return;

    // Siempre pedir datos frescos a la API al cargar la página
    const productos = await obtenerProductos(true);

    const inputBusqueda = document.getElementById("search-input");

    function filtrarProductos() {
      const termino = (inputBusqueda?.value || "").toLowerCase().trim();
      if (!termino) return productos;
      return productos.filter((p) => {
        const texto = `${p.nombre ?? ""} ${p.descripcion ?? ""}`.toLowerCase();
        return texto.includes(termino);
      });
    }

    function crearCard(producto) {
      const precio =
        tipoPagina === "mayorista" ? producto.precio_mayorista : producto.precio_minorista;

      const card = document.createElement("article");
      card.className = "product-card";

      const imageWrapper = document.createElement("div");
      imageWrapper.className = "product-image-wrapper";

      const img = document.createElement("img");
      img.className = "product-image";
      img.src = producto.imagen || "images/productos/placeholder.jpg";
      img.alt = producto.nombre || "Producto Migas & Sabores";

      const tag = document.createElement("span");
      tag.className = "product-tag";
      tag.textContent = tipoPagina === "mayorista" ? "Mayorista" : "Minorista";

      imageWrapper.appendChild(img);
      imageWrapper.appendChild(tag);

      const body = document.createElement("div");
      body.className = "product-body";

      const title = document.createElement("h3");
      title.className = "product-title";
      title.textContent = producto.nombre;

      const desc = document.createElement("p");
      desc.className = "product-description";
      desc.textContent = producto.descripcion;

      const price = document.createElement("p");
      price.className = "product-price";
      const precioFormateado = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
      }).format(precio || 0);
      price.innerHTML =
        tipoPagina === "mayorista"
          ? `${precioFormateado} <span>por unidad (mínimo 1 docena)</span>`
          : `${precioFormateado} <span>precio final</span>`;

      const footer = document.createElement("div");
      footer.className = "product-footer";

      const quantity = document.createElement("div");
      quantity.className = "quantity-selector";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "quantity-btn";
      minusBtn.textContent = "−";

      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.className = "quantity-input";
      qtyInput.value = "1";
      qtyInput.min = "1";

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "quantity-btn";
      plusBtn.textContent = "+";

      minusBtn.addEventListener("click", () => {
        const actual = parseInt(qtyInput.value || "1", 10);
        if (actual > 1) qtyInput.value = String(actual - 1);
      });

      plusBtn.addEventListener("click", () => {
        const actual = parseInt(qtyInput.value || "1", 10);
        qtyInput.value = String(actual + 1);
      });

      qtyInput.addEventListener("input", () => {
        const n = parseInt(qtyInput.value || "1", 10);
        if (Number.isNaN(n) || n < 1) {
          qtyInput.value = "1";
        }
      });

      quantity.appendChild(minusBtn);
      quantity.appendChild(qtyInput);
      quantity.appendChild(plusBtn);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary btn-add-to-cart";
      addBtn.textContent =
        tipoPagina === "mayorista" ? "Agregar (docenas mín. 1)" : "Agregar al pedido";

      addBtn.addEventListener("click", () => {
        const baseCantidad = parseInt(qtyInput.value || "1", 10);
        if (!window.Carrito) return;
        const cantidadValida = Number.isNaN(baseCantidad) || baseCantidad < 1 ? 1 : baseCantidad;
        const cantidadFinal =
          tipoPagina === "mayorista" ? cantidadValida * 12 : cantidadValida;

        window.Carrito.agregarItem({
          id: producto.id,
          nombre: producto.nombre,
          tipoPrecio: tipoPagina,
          precioUnitario: precio,
          cantidad: cantidadFinal
        });
      });

      footer.appendChild(quantity);
      footer.appendChild(addBtn);

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(price);
      body.appendChild(footer);

      card.appendChild(imageWrapper);
      card.appendChild(body);

      return card;
    }

    function render() {
      contenedor.innerHTML = "";
      const lista = filtrarProductos();

      if (productos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "catalog-empty-message";
        vacio.textContent =
          "No se pudieron cargar los productos. Asegurate de tener el servidor en marcha (npm start) y de que haya productos en el panel de administrador.";
        contenedor.appendChild(vacio);
        return;
      }

      if (!lista.length) {
        const vacio = document.createElement("p");
        vacio.className = "catalog-empty-message";
        vacio.textContent = "No encontramos productos con ese criterio.";
        contenedor.appendChild(vacio);
        return;
      }

      lista.forEach((p) => {
        contenedor.appendChild(crearCard(p));
      });
    }

    if (inputBusqueda) {
      inputBusqueda.addEventListener("input", () => {
        render();
      });
    }

    render();
  }

  return {
    obtenerProductos,
    invalidarCache,
    buscarPorId,
    renderizarParaVenta
  };
})();

window.Catalogo = Catalogo;

// Inicialización en páginas de catálogo (mayorista / minorista)
document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("product-list");
  if (!contenedor) return;
  const tipo = contenedor.getAttribute("data-tipo") || "minorista";
  Catalogo.renderizarParaVenta(tipo);
});
