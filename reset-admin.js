// reset-admin.js
// Script seguro para actualizar/crear el usuario `admin` con la contraseña en .env
// Uso: `node reset-admin.js` (usa MONGO_URI y ADMIN_DEFAULT_PASSWORD del .env o variables de entorno)

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('FATAL: define MONGO_URI en .env o en variables de entorno');
    process.exit(1);
  }

  const pass = process.env.ADMIN_DEFAULT_PASSWORD || 'Migas2025Admin!';
  if (!pass || pass.length < 8) {
    console.warn('Advertencia: la contraseña es corta. Asegurate de usar una contraseña segura.');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('Conectado a MongoDB para resetear admin');

    const hash = await bcrypt.hash(pass, 10);
    const res = await Admin.findOneAndUpdate(
      { username: 'admin' },
      { username: 'admin', passwordHash: hash, loginAttempts: 0, lockUntil: null },
      { upsert: true, new: true }
    );

    console.log('Admin actualizado/creado:', res.username);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error en reset-admin:', err.message || err);
    process.exit(1);
  }
}

run();
