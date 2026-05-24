require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Product = require("./models/Product");
const Admin = require("./models/Admin");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── SEGURIDAD: cabeceras HTTP seguras ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

// ─── CORS: solo acepta peticiones del mismo origen (Render) ─────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("CORS: origen no permitido"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "x-admin-token"]
}));

// Aumentamos límite temporalmente para permitir DataURLs de imágenes pequeñas
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname)));

// ─── RATE LIMITING GLOBAL ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intentá más tarde." }
});
app.use(globalLimiter);

// ─── RATE LIMITING ESTRICTO para escritura (POST/PUT/DELETE) ─────────────────
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Límite de escrituras alcanzado. Esperá un minuto." }
});

// ─── RATE LIMITING MUY ESTRICTO para login ───────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiados intentos de login. Bloqueado 15 minutos." }
});

// ─── AUTENTICACIÓN VIA TOKEN DE SESIÓN ───────────────────────────────────────
const activeSessions = new Map();
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function generarToken() {
  return require("crypto").randomBytes(32).toString("hex");
}

function limpiarSesionesExpiradas() {
  const ahora = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < ahora) activeSessions.delete(token);
  }
}

function requireAdminAuth(req, res, next) {
  limpiarSesionesExpiradas();
  const token = req.headers["x-admin-token"];
  console.log("requireAdminAuth - tokenPresent:", !!token, "activeSessions:", activeSessions.size);
  if (!token || !activeSessions.has(token)) {
    console.log("requireAdminAuth - denied. tokenPresent:", !!token, "hasToken:", activeSessions.has(token));
    return res.status(401).json({ error: "No autorizado. Iniciá sesión en el panel de administración." });
  }
  const session = activeSessions.get(token);
  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return res.status(401).json({ error: "Sesión expirada. Volvé a iniciar sesión." });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

// ─── HELPER ──────────────────────────────────────────────────────────────────
function toProductResponse(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(p._id),
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio_minorista: p.precio_minorista,
    precio_mayorista: p.precio_mayorista,
    imagen: p.imagen || ""
  };
}

function sanitizeString(str, maxLen = 500) {
  if (typeof str !== "string") return "";
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().substring(0, maxLen);
}

function contieneCaracteresExoticos(str) {
  if (!str) return false;
  const exoticos = (str.match(/[\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF\u3040-\u30FF]/g) || []).length;
  return exoticos / str.length > 0.3;
}

// ─── RUTAS PÚBLICAS (solo lectura) ───────────────────────────────────────────

app.get("/api/productos", async (req, res) => {
  try {
    const docs = await Product.find().sort({ createdAt: -1 }).limit(100);
    res.json({ productos: docs.map(toProductResponse) });
  } catch (err) {
    console.error("GET /api/productos", err.message);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const mongoOk = mongoose.connection.readyState === 1;
    const count = mongoOk ? await Product.countDocuments() : 0;
    res.json({ ok: true, mongo: mongoOk, productos: count });
  } catch (err) {
    res.status(500).json({ ok: false, mongo: false, error: err.message });
  }
});

// POST /api/admin/login — login (con rate limit estricto y bloqueo por intentos)
app.post("/api/admin/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = sanitizeString(String(username || "")).toLowerCase();
    const pass = String(password || "").trim();

    console.log("POST /api/admin/login - intento de login para:", user);

    if (!user || !pass) {
      return res.status(400).json({ ok: false, error: "Faltan usuario o contraseña" });
    }
    if (pass.length < 8) {
      return res.status(400).json({ ok: false, error: "Contraseña demasiado corta" });
    }

    const admin = await Admin.findOne({ username: user });
    if (!admin || !admin.passwordHash) {
      await bcrypt.compare("dummy", "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
      return res.json({ ok: false, error: "Usuario o contraseña incorrectos" });
    }

    if (admin.isLocked()) {
      return res.status(423).json({ ok: false, error: "Cuenta bloqueada por demasiados intentos. Esperá 30 minutos." });
    }

    const match = await bcrypt.compare(pass, admin.passwordHash);
    if (!match) {
      await admin.incLoginAttempts();
      return res.json({ ok: false, error: "Usuario o contraseña incorrectos" });
    }

    await admin.resetLoginAttempts();

    const token = generarToken();
    activeSessions.set(token, {
      username: user,
      expiresAt: Date.now() + SESSION_TTL_MS
    });

    res.json({ ok: true, token });
  } catch (err) {
    console.error("POST /api/admin/login", err.message);
    res.status(500).json({ ok: false, error: "Error al validar credenciales" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token) activeSessions.delete(token);
  res.json({ ok: true });
});

// ─── RUTAS PROTEGIDAS (requieren token de admin) ──────────────────────────────

app.post("/api/productos", requireAdminAuth, writeLimiter, async (req, res) => {
  try {
    console.log("POST /api/productos - x-admin-token present:", !!req.headers['x-admin-token'], "bodyKeys:", Object.keys(req.body || {}));
    let { nombre, descripcion, precio_minorista, precio_mayorista, imagen } = req.body;

    nombre = sanitizeString(nombre, 200);
    descripcion = sanitizeString(descripcion, 1000);

    if (!nombre || !descripcion || precio_minorista == null || precio_mayorista == null) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    if (contieneCaracteresExoticos(nombre) || contieneCaracteresExoticos(descripcion)) {
      return res.status(400).json({ error: "El texto contiene caracteres no permitidos" });
    }

    const precioMin = Number(precio_minorista);
    const precioMay = Number(precio_mayorista);
    if (isNaN(precioMin) || precioMin < 0 || precioMin > 999999) {
      return res.status(400).json({ error: "Precio minorista inválido" });
    }
    if (isNaN(precioMay) || precioMay < 0 || precioMay > 999999) {
      return res.status(400).json({ error: "Precio mayorista inválido" });
    }

    if (imagen && typeof imagen === "string") {
      if (imagen.length > 1_500_000) {
        return res.status(400).json({ error: "Imagen demasiado grande" });
      }
      if (!/^(data:image\/(jpeg|png|webp|gif);base64,|\/|https?:\/\/)/.test(imagen)) {
        return res.status(400).json({ error: "Formato de imagen no permitido" });
      }
    }

    const doc = await Product.create({
      nombre,
      descripcion,
      precio_minorista: precioMin,
      precio_mayorista: precioMay,
      imagen: imagen || ""
    });
    res.status(201).json(toProductResponse(doc));
  } catch (err) {
    console.error("POST /api/productos", err.message);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.put("/api/productos/:id", requireAdminAuth, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("PUT /api/productos/:id - x-admin-token present:", !!req.headers['x-admin-token'], "id:", id, "bodyKeys:", Object.keys(req.body || {}));
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    let { nombre, descripcion, precio_minorista, precio_mayorista, imagen } = req.body;

    if (nombre != null) nombre = sanitizeString(nombre, 200);
    if (descripcion != null) descripcion = sanitizeString(descripcion, 1000);

    if (contieneCaracteresExoticos(nombre) || contieneCaracteresExoticos(descripcion)) {
      return res.status(400).json({ error: "El texto contiene caracteres no permitidos" });
    }

    const update = {};
    if (nombre) update.nombre = nombre;
    if (descripcion) update.descripcion = descripcion;
    if (precio_minorista != null) {
      const v = Number(precio_minorista);
      if (isNaN(v) || v < 0 || v > 999999) return res.status(400).json({ error: "Precio minorista inválido" });
      update.precio_minorista = v;
    }
    if (precio_mayorista != null) {
      const v = Number(precio_mayorista);
      if (isNaN(v) || v < 0 || v > 999999) return res.status(400).json({ error: "Precio mayorista inválido" });
      update.precio_mayorista = v;
    }
    if (imagen != null) update.imagen = imagen;

    const doc = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(toProductResponse(doc));
  } catch (err) {
    console.error("PUT /api/productos/:id", err.message);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

app.delete("/api/productos/:id", requireAdminAuth, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("DELETE /api/productos/:id - x-admin-token present:", !!req.headers['x-admin-token'], "id:", id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/productos/:id", err.message);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// ─── CONEXIÓN A MONGODB Y ARRANQUE ───────────────────────────────────────────
async function start() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("FATAL: Falta MONGO_URI en las variables de entorno");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("Conectado a MongoDB");

    const count = await Product.countDocuments();
    if (count === 0) {
      const jsonPath = path.join(__dirname, "data", "productos.json");
      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        if (data.productos && data.productos.length) {
          const toInsert = data.productos.map((p) => ({
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio_minorista: p.precio_minorista,
            precio_mayorista: p.precio_mayorista,
            imagen: p.imagen || ""
          }));
          await Product.insertMany(toInsert);
          console.log("Productos iniciales cargados desde data/productos.json");
        }
      }
    }

    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD;
      if (!defaultPass) {
        console.warn("ADMIN_DEFAULT_PASSWORD no configurada. Usando contraseña por defecto insegura.");
      }
      const hash = await bcrypt.hash(defaultPass || "Migas2025Admin!", 10);
      await Admin.create({ username: "admin", passwordHash: hash });
      console.log("Admin inicial creado con la contraseña configurada en ADMIN_DEFAULT_PASSWORD");
    }
  } catch (err) {
    console.error("Error conectando a MongoDB:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

start();
