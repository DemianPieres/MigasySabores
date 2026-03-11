const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    precio_minorista: { type: Number, required: true, min: 0 },
    precio_mayorista: { type: Number, required: true, min: 0 },
    imagen: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
