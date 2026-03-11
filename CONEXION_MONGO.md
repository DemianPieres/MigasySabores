# Conexión a MongoDB Atlas

Si el servidor no conecta a MongoDB o en el panel de Atlas no ves la base de datos, revisá:

1. **Network Access (Acceso de red)**  
   En MongoDB Atlas: tu proyecto → **Network Access** → **Add IP Address**.  
   Agregá `0.0.0.0/0` para permitir conexiones desde cualquier IP (o la IP de tu PC/servidor).

2. **Cluster activo**  
   En la lista de clusters, si dice "Paused" o "Pausado", hacé clic en **Resume** para activarlo.

3. **Usuario y contraseña**  
   El archivo `.env` usa el usuario que configuraste en Atlas.  
   Si la contraseña tiene caracteres especiales (`@`, `#`, `:`, `/`, `%`, etc.), tenés que codificarlos en la URL (por ejemplo `@` → `%40`).

4. **Probar la conexión**  
   Con el servidor levantado (`npm start`), abrí en el navegador:  
   `http://localhost:3000/api/health`  
   Deberías ver algo como: `{"ok":true,"mongo":true,"productos":5}`.  
   Si `mongo` es `false`, la conexión a MongoDB falló.

5. **Panel admin**  
   Las credenciales se guardan en la colección **admins** de MongoDB. La primera vez que arrancás el servidor se crea un usuario por defecto:
   - Usuario: **admin**
   - Contraseña: **Migas2025**  
   Entrá siempre desde el servidor: `http://localhost:3000/admin.html` (no abras el archivo directo con doble clic).
