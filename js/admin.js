/**
 * Panel administrador – CRUD de productos contra la API (MongoDB).
 * Solo depende de esta página; no usa catalogo.js.
 */

(function () {
  "use strict";

  // La API (Node) corre en el puerto 3000. Si abrís el admin con Live Server (5500) u otro, se usa igual el 3000.
  var BACKEND_PORT = 3000;
  var port = parseInt(window.location.port, 10) || (window.location.protocol === "https:" ? 443 : 80);
  var API_BASE = (port !== BACKEND_PORT) ? "http://localhost:" + BACKEND_PORT : window.location.origin;
  var API_PRODUCTOS = API_BASE + "/api/productos";
  var API_ADMIN_LOGIN = API_BASE + "/api/admin/login";
  var ADMIN_AUTH_KEY = "migas_admin_authed";

  var addProductBtn, tbody, modalOverlay, modalTitle, productForm, productIdInput;
  var productNameInput, productDescInput, priceMinoristaInput, priceMayoristaInput;
  var imageFileInput, imagePreview, imagePreviewPlaceholder, modalClose, modalCancel, statusEl, hintOffline;

  var productosActuales = [];
  var productoEditando = null;

  function get(id) {
    return document.getElementById(id);
  }

  function estaAutenticado() {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === "true";
  }

  function setAutenticado(val) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, val ? "true" : "false");
  }

  function mostrarLogin() {
    var loginView = get("admin-login");
    var dashboardView = get("admin-dashboard");
    if (loginView) loginView.classList.remove("admin-hidden");
    if (dashboardView) dashboardView.classList.add("admin-hidden");
  }

  function mostrarDashboard() {
    var loginView = get("admin-login");
    var dashboardView = get("admin-dashboard");
    if (loginView) loginView.classList.add("admin-hidden");
    if (dashboardView) dashboardView.classList.remove("admin-hidden");
    setupProductPanel();
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "admin-status " + (isError ? "admin-status-error" : "");
  }

  function showModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove("modal-hidden");
    modalOverlay.setAttribute("aria-hidden", "false");
    modalOverlay.style.cssText = "display:flex !important; visibility:visible !important; z-index:99999 !important;";
    document.body.style.overflow = "hidden";
  }

  function hideModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.add("modal-hidden");
    modalOverlay.setAttribute("aria-hidden", "true");
    modalOverlay.style.cssText = "";
    document.body.style.overflow = "";
  }

  function abrirModalNuevo() {
    productoEditando = null;
    if (productIdInput) productIdInput.value = "";
    if (productNameInput) productNameInput.value = "";
    if (productDescInput) productDescInput.value = "";
    if (priceMinoristaInput) priceMinoristaInput.value = "";
    if (priceMayoristaInput) priceMayoristaInput.value = "";
    if (imageFileInput) imageFileInput.value = "";
    actualizarVistaPrevia(null);
    if (modalTitle) modalTitle.textContent = "Nuevo producto";
    showModal();
  }

  function abrirModalEditar(p) {
    productoEditando = p;
    if (productIdInput) productIdInput.value = p.id || "";
    if (productNameInput) productNameInput.value = p.nombre || "";
    if (productDescInput) productDescInput.value = p.descripcion || "";
    if (priceMinoristaInput) priceMinoristaInput.value = p.precio_minorista ?? "";
    if (priceMayoristaInput) priceMayoristaInput.value = p.precio_mayorista ?? "";
    if (imageFileInput) imageFileInput.value = "";
    actualizarVistaPrevia(p.imagen || null);
    if (modalTitle) modalTitle.textContent = "Editar producto";
    showModal();
  }

  function actualizarVistaPrevia(src) {
    if (imagePreview) {
      imagePreview.src = src || "";
      imagePreview.style.display = src ? "block" : "none";
    }
    if (imagePreviewPlaceholder) {
      imagePreviewPlaceholder.style.display = src ? "none" : "block";
    }
  }

  function apiGet() {
    return fetch(API_PRODUCTOS, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        return data && Array.isArray(data.productos) ? data.productos : null;
      })
      .catch(function () { return null; });
  }

  function apiPost(body) {
    return fetch(API_PRODUCTOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).catch(function () { return null; });
  }

  function apiPut(id, body) {
    return fetch(API_PRODUCTOS + "/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).catch(function () { return null; });
  }

  function apiDelete(id) {
    return fetch(API_PRODUCTOS + "/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (res) { return res.ok; })
      .catch(function () { return false; });
  }

  function renderTabla() {
    if (!tbody) return;
    var fragment = document.createDocumentFragment();

    if (productosActuales.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.className = "admin-empty-cell";
      td.textContent = "No hay productos. Usá el botón «Agregar nuevo producto».";
      tr.appendChild(td);
      fragment.appendChild(tr);
    } else {
      productosActuales.forEach(function (p) {
        var tr = document.createElement("tr");
        var tdImg = document.createElement("td");
        tdImg.className = "admin-col-img";
        var img = document.createElement("img");
        img.className = "admin-product-image";
        img.src = p.imagen || "images/productos/placeholder.jpg";
        img.alt = p.nombre || "";
        img.decoding = "async";
        img.onerror = function () { img.src = "images/productos/placeholder.jpg"; };
        tdImg.appendChild(img);

        var tdNombre = document.createElement("td");
        tdNombre.className = "admin-col-name";
        tdNombre.textContent = p.nombre || "";

        var tdDesc = document.createElement("td");
        tdDesc.className = "admin-col-desc";
        tdDesc.textContent = (p.descripcion || "").substring(0, 80) + ((p.descripcion || "").length > 80 ? "…" : "");

        var tdMin = document.createElement("td");
        tdMin.className = "admin-col-price admin-prices";
        tdMin.textContent = "$" + (p.precio_minorista ?? 0);

        var tdMay = document.createElement("td");
        tdMay.className = "admin-col-price admin-prices";
        tdMay.textContent = "$" + (p.precio_mayorista ?? 0);

        var tdAcc = document.createElement("td");
        tdAcc.className = "admin-col-actions admin-actions";
        var btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn btn-light btn-small";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", function () { abrirModalEditar(p); });
        var btnEliminar = document.createElement("button");
        btnEliminar.type = "button";
        btnEliminar.className = "btn btn-danger btn-small";
        btnEliminar.textContent = "Eliminar";
        btnEliminar.addEventListener("click", function () {
          if (!confirm("¿Eliminar este producto?")) return;
          apiDelete(p.id).then(function (ok) {
            if (ok) cargarProductos(true);
            else alert("No se pudo eliminar. Revisá que el servidor esté en marcha.");
          });
        });
        tdAcc.appendChild(btnEditar);
        tdAcc.appendChild(btnEliminar);

        tr.appendChild(tdImg);
        tr.appendChild(tdNombre);
        tr.appendChild(tdDesc);
        tr.appendChild(tdMin);
        tr.appendChild(tdMay);
        tr.appendChild(tdAcc);
        fragment.appendChild(tr);
      });
    }

    if (tbody.replaceChildren) {
      tbody.replaceChildren(fragment);
    } else {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      tbody.appendChild(fragment);
    }
  }

  function mostrarErrorConexion() {
    if (!tbody) return;
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 6;
    td.className = "admin-empty-cell admin-error-cell";
    td.textContent = "No se pudo conectar al servidor.";
    tr.appendChild(td);
    if (tbody.replaceChildren) {
      tbody.replaceChildren(tr);
    } else {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      tbody.appendChild(tr);
    }
    if (hintOffline) {
      hintOffline.textContent = "Abrí siempre desde http://localhost:3000/admin.html con el servidor en marcha (npm start). Los productos se guardan en la base de datos y se ven en tiempo real en mayorista y minorista.";
      hintOffline.style.display = "block";
    }
  }

  function cargarProductos(silent) {
    if (!silent) setStatus("Cargando…", false);
    apiGet().then(function (lista) {
      if (lista === null) {
        productosActuales = [];
        mostrarErrorConexion();
        setStatus("Sin conexión", true);
        return;
      }
      productosActuales = lista;
      renderTabla();
      if (hintOffline) hintOffline.style.display = "none";
      if (!silent) setStatus("Conectado · " + lista.length + " producto(s)", false);
    });
  }

  function submitProduct(e) {
    e.preventDefault();
    var nombre = (productNameInput && productNameInput.value || "").trim();
    var descripcion = (productDescInput && productDescInput.value || "").trim();
    var precioMin = Number(priceMinoristaInput && priceMinoristaInput.value);
    var precioMay = Number(priceMayoristaInput && priceMayoristaInput.value);

    if (!nombre || !descripcion) {
      alert("Nombre y descripción son obligatorios.");
      return;
    }
    if (isNaN(precioMin) || precioMin < 0 || isNaN(precioMay) || precioMay < 0) {
      alert("Los precios deben ser números ≥ 0.");
      return;
    }

    var imagen = productoEditando ? (productoEditando.imagen || "") : "";
    var file = imageFileInput && imageFileInput.files && imageFileInput.files[0];

    function sendBody(imagenBase64) {
      var body = {
        nombre: nombre,
        descripcion: descripcion,
        precio_minorista: precioMin,
        precio_mayorista: precioMay,
        imagen: imagenBase64 || ""
      };

      if (productoEditando && productIdInput && productIdInput.value) {
        apiPut(productoEditando.id, body).then(function (updated) {
          if (updated) {
            hideModal();
            cargarProductos(true);
          } else {
            alert("No se pudo actualizar. Revisá que el servidor esté en marcha.");
          }
        });
      } else {
        apiPost(body).then(function (created) {
          if (created) {
            hideModal();
            cargarProductos(true);
          } else {
            alert("No se pudo crear. Revisá que el servidor esté en marcha.");
          }
        });
      }
    }

    if (file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var result = ev.target && ev.target.result;
        sendBody(typeof result === "string" ? result : imagen);
      };
      reader.onerror = function () { sendBody(imagen); };
      reader.readAsDataURL(file);
    } else {
      sendBody(imagen);
    }
  }

  function setupProductPanel() {
    addProductBtn = get("add-product-btn");
    tbody = get("products-tbody");
    modalOverlay = get("product-modal");
    modalTitle = get("modal-title");
    productForm = get("product-form");
    productIdInput = get("product-id");
    productNameInput = get("product-name");
    productDescInput = get("product-description");
    priceMinoristaInput = get("product-price-minorista");
    priceMayoristaInput = get("product-price-mayorista");
    imageFileInput = get("product-image-file");
    imagePreview = get("image-preview");
    imagePreviewPlaceholder = get("image-preview-placeholder");
    modalClose = get("modal-close");
    modalCancel = get("modal-cancel");
    statusEl = get("admin-status");
    hintOffline = get("admin-hint-offline");

    if (!modalOverlay || !addProductBtn) {
      if (statusEl) setStatus("Error: faltan elementos del panel", true);
      return;
    }

    window.abrirModalAdmin = abrirModalNuevo;

    addProductBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      abrirModalNuevo();
    });

    if (modalClose) modalClose.addEventListener("click", hideModal);
    if (modalCancel) modalCancel.addEventListener("click", hideModal);
    if (modalOverlay) modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) hideModal();
    });

    if (imageFileInput) {
      imageFileInput.addEventListener("change", function () {
        var file = imageFileInput.files && imageFileInput.files[0];
        if (!file) {
          actualizarVistaPrevia(productoEditando ? productoEditando.imagen : null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          var r = ev.target && ev.target.result;
          if (typeof r === "string") actualizarVistaPrevia(r);
        };
        reader.readAsDataURL(file);
      });
    }

    if (productForm) productForm.addEventListener("submit", submitProduct);

    cargarProductos();
  }

  function init() {
    var loginForm = get("admin-login-form");
    var loginError = get("admin-login-error");
    var logoutBtn = get("admin-logout-btn");
    var userInput = get("admin-user");
    var passInput = get("admin-pass");

    if (estaAutenticado()) {
      mostrarDashboard();
    } else {
      mostrarLogin();
    }

    if (loginForm && userInput && passInput) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (loginError) loginError.textContent = "";
        var user = (userInput.value || "").trim().toLowerCase();
        var pass = (passInput.value || "").trim();
        if (!user || !pass) {
          if (loginError) loginError.textContent = "Completá usuario y contraseña.";
          return;
        }
        fetch(API_ADMIN_LOGIN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user, password: pass })
        })
          .then(function (res) { return res.json().catch(function () { return {}; }); })
          .then(function (data) {
            if (data && data.ok) {
              setAutenticado(true);
              mostrarDashboard();
            } else {
              if (loginError) loginError.textContent = (data && data.error) ? data.error : "Usuario o contraseña incorrectos.";
            }
          })
          .catch(function () {
            if (loginError) loginError.textContent = "No se pudo conectar. ¿Está el servidor en marcha (npm start)?";
          });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        setAutenticado(false);
        mostrarLogin();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
