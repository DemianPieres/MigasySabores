require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Product = require("./models/Product");
const Admin = require("./models/Admin");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

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

// GET /api/productos — listar todos
app.get("/api/productos", async (req, res) => {
  try {
    const docs = await Product.find().sort({ createdAt: 1 });
    const productos = docs.map((d) => toProductResponse(d));
    res.json({ productos });
  } catch (err) {
    console.error("GET /api/productos", err);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

// POST /api/productos — crear
app.post("/api/productos", async (req, res) => {
  try {
    const { nombre, descripcion, precio_minorista, precio_mayorista, imagen } = req.body;
    if (!nombre || !descripcion || precio_minorista == null || precio_mayorista == null) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    const doc = await Product.create({
      nombre,
      descripcion,
      precio_minorista: Number(precio_minorista),
      precio_mayorista: Number(precio_mayorista),
      imagen: imagen || ""
    });
    res.status(201).json(toProductResponse(doc));
  } catch (err) {
    console.error("POST /api/productos", err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

// PUT /api/productos/:id — actualizar
app.put("/api/productos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const { nombre, descripcion, precio_minorista, precio_mayorista, imagen } = req.body;
    const doc = await Product.findByIdAndUpdate(
      id,
      {
        ...(nombre != null && { nombre }),
        ...(descripcion != null && { descripcion }),
        ...(precio_minorista != null && { precio_minorista: Number(precio_minorista) }),
        ...(precio_mayorista != null && { precio_mayorista: Number(precio_mayorista) }),
        ...(imagen != null && { imagen })
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(toProductResponse(doc));
  } catch (err) {
    console.error("PUT /api/productos/:id", err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// DELETE /api/productos/:id — eliminar
app.delete("/api/productos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/productos/:id", err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// POST /api/admin/login — validar credenciales contra la colección admins
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = (username || "").trim().toLowerCase();
    const pass = (password || "").trim();
    if (!user || !pass) {
      return res.status(400).json({ ok: false, error: "Faltan usuario o contraseña" });
    }
    const admin = await Admin.findOne({ username: user });
    if (!admin || !admin.passwordHash) {
      return res.json({ ok: false, error: "Usuario o contraseña incorrectos" });
    }
    const match = await bcrypt.compare(pass, admin.passwordHash);
    if (!match) {
      return res.json({ ok: false, error: "Usuario o contraseña incorrectos" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/login", err);
    res.status(500).json({ ok: false, error: "Error al validar credenciales" });
  }
});

// Endpoint para verificar que el servidor y MongoDB responden
app.get("/api/health", async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const mongoOk = state === 1;
    const count = mongoOk ? await Product.countDocuments() : 0;
    res.json({
      ok: true,
      mongo: mongoOk,
      state: state,
      productos: count
    });
  } catch (err) {
    res.status(500).json({ ok: false, mongo: false, error: err.message });
  }
});

function normalizeMongoUri(uri) {
  if (!uri || typeof uri !== "string") return uri;
  let u = uri.trim();
  if (!u.includes("/migas") && !u.includes("?")) {
    u = u.replace(/\/?$/, "") + "/migas";
  } else if (!u.includes("/migas")) {
    u = u.replace(/(\?|$)/, "/migas$1");
  }
  if (!u.includes("retryWrites")) {
    u += u.includes("?") ? "&" : "?";
    u += "retryWrites=true&w=majority";
  }
  return u;
}

async function start() {
  let uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Falta MONGO_URI en el archivo .env");
    process.exit(1);
  }
  uri = normalizeMongoUri(uri);
  try {
    await mongoose.connect(uri);
    console.log("Conectado a MongoDB (base: migas)");
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
      const hash = await bcrypt.hash("Migas2025", 10);
      await Admin.create({ username: "admin", passwordHash: hash });
      console.log("Admin inicial creado. Usuario: admin  Contraseña: Migas2025");
    }
  } catch (err) {
    console.error("Error conectando a MongoDB:", err.message);
    console.error("Revisá: 1) Usuario/contraseña en .env  2) En Atlas: Network Access (0.0.0.0/0)  3) Cluster no pausado");
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

start();
