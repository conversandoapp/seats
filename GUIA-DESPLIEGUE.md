# 📘 GUÍA COMPLETA: Desplegar en Render con GitHub

## 🎯 Objetivo
Desplegar el Sistema de Graduación Laureate en Render usando GitHub para que esté disponible en internet.

---

## 📋 PASO 1: Preparar tu Repositorio en GitHub

### 1.1 Crear cuenta en GitHub (si no tienes)
- Ve a https://github.com
- Haz clic en "Sign up"
- Completa el registro

### 1.2 Crear un nuevo repositorio
1. En GitHub, haz clic en el botón **"+"** (arriba a la derecha)
2. Selecciona **"New repository"**
3. Completa los datos:
   - **Repository name**: `sistema-graduacion-laureate` (o el nombre que prefieras)
   - **Description**: "Sistema de ubicación de asientos para graduación"
   - **Visibility**: Puede ser Public o Private
   - ✅ **NO marques** "Initialize this repository with a README"
4. Haz clic en **"Create repository"**

---

## 📂 PASO 2: Subir tus archivos a GitHub

### Opción A: Usando GitHub Desktop (Más fácil - Recomendado)

1. **Descarga GitHub Desktop**:
   - Ve a https://desktop.github.com
   - Descarga e instala

2. **Conecta tu cuenta**:
   - Abre GitHub Desktop
   - File → Options → Accounts
   - Sign in to GitHub.com

3. **Clonar tu repositorio**:
   - File → Clone Repository
   - Busca `sistema-graduacion-laureate`
   - Elige la carpeta donde lo guardarás
   - Clone

4. **Agregar tus archivos**:
   - Copia TODOS estos archivos a la carpeta del repositorio:
     ```
     ├── server.js
     ├── package.json
     ├── .gitignore
     ├── README.md
     └── public/
         ├── graduacion-asientos.html
         └── visor-tiempo-real.html
     ```

5. **Hacer commit y push**:
   - GitHub Desktop detectará los cambios automáticamente
   - En la esquina inferior izquierda:
     - **Summary**: "Versión inicial del sistema"
     - **Description**: "Sistema de graduación con visor en tiempo real"
   - Haz clic en **"Commit to main"**
   - Haz clic en **"Push origin"** (arriba)

### Opción B: Usando Git por línea de comandos

```bash
# 1. Inicializar git en tu carpeta del proyecto
cd tu-carpeta-del-proyecto
git init

# 2. Agregar todos los archivos
git add .

# 3. Hacer el primer commit
git commit -m "Versión inicial del sistema"

# 4. Conectar con tu repositorio en GitHub
git remote add origin https://github.com/TU-USUARIO/sistema-graduacion-laureate.git

# 5. Subir los archivos
git branch -M main
git push -u origin main
```

---

## 🚀 PASO 3: Desplegar en Render

### 3.1 Crear cuenta en Render
1. Ve a https://render.com
2. Haz clic en **"Get Started"** o **"Sign Up"**
3. **IMPORTANTE**: Regístrate usando tu cuenta de GitHub (Sign up with GitHub)
4. Autoriza a Render a acceder a GitHub

### 3.2 Crear un nuevo Web Service
1. En el Dashboard de Render, haz clic en **"New +"**
2. Selecciona **"Web Service"**

### 3.3 Conectar tu repositorio
1. Render mostrará tus repositorios de GitHub
2. Busca `sistema-graduacion-laureate`
3. Haz clic en **"Connect"**

### 3.4 Configurar el servicio
Completa estos campos:

- **Name**: `sistema-graduacion-laureate` (o cualquier nombre único)
- **Region**: Elige la más cercana (ej: Oregon USA)
- **Branch**: `main`
- **Root Directory**: Dejar en blanco
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Selecciona **"Free"** (puedes upgradear después)

### 3.5 Variables de entorno (opcional)
- No necesitas agregar ninguna por ahora
- Si quieres, puedes agregar:
  - `NODE_ENV` = `production`

### 3.6 Desplegar
1. Revisa que todo esté correcto
2. Haz clic en **"Create Web Service"**
3. Render comenzará a construir y desplegar tu aplicación
4. Este proceso toma 2-5 minutos

---

## ✅ PASO 4: Verificar el Despliegue

### 4.1 Esperar a que termine el despliegue
- Verás logs en tiempo real
- Espera a ver el mensaje: `Your service is live 🎉`
- El estado cambiará a **"Live"** (con un punto verde)

### 4.2 Obtener tu URL
- Render te asignará una URL automáticamente
- Algo como: `https://sistema-graduacion-laureate.onrender.com`
- Esta URL se muestra en la parte superior del dashboard

### 4.3 Probar tu aplicación
Abre dos pestañas:

1. **Sistema Principal**:
   - URL: `https://tu-app.onrender.com/`
   - Prueba con código: `u200910086` o `u200910025`

2. **Visor en Tiempo Real**:
   - URL: `https://tu-app.onrender.com/visor`
   - Debe mostrar el panel de control vacío inicialmente

3. **Probar la sincronización**:
   - Ingresa códigos en el sistema principal
   - Ve al visor y verás los asientos marcarse en rojo automáticamente

---

## 🔄 PASO 5: Actualizar tu Aplicación (después)

Cuando quieras hacer cambios:

### Usando GitHub Desktop:
1. Modifica tus archivos localmente
2. Abre GitHub Desktop
3. Verás los cambios automáticamente
4. Escribe un mensaje describiendo los cambios
5. Haz clic en **"Commit to main"**
6. Haz clic en **"Push origin"**
7. Render detectará los cambios y redesplegaría automáticamente

### Usando Git por línea de comandos:
```bash
git add .
git commit -m "Descripción de los cambios"
git push
```

---

## 🎓 URLs Finales

Una vez desplegado, tendrás:

- **Sistema de Graduación**: `https://tu-app.onrender.com/`
- **Visor en Tiempo Real**: `https://tu-app.onrender.com/visor`

---

## ⚠️ NOTAS IMPORTANTES

### Plan Free de Render:
- ✅ Gratis para siempre
- ✅ Perfecto para este proyecto
- ⚠️ Si la app no recibe tráfico por 15 minutos, se "duerme"
- ⚠️ Al despertar, la primera carga toma ~30 segundos
- 💡 Para mantenerla activa 24/7, necesitarías el plan Starter ($7/mes)

### Limitación del Almacenamiento:
- El sistema actual usa `window.storage` del navegador
- Esto significa que los datos son locales a cada dispositivo
- Para un sistema real en producción, considera:
  - Usar una base de datos (Firebase, MongoDB, etc.)
  - Implementar un backend con WebSockets
  - Usar Redis para datos en tiempo real

### Dominio Personalizado (opcional):
Si quieres usar tu propio dominio:
1. Ve a Settings → Custom Domain en Render
2. Agrega tu dominio
3. Configura los DNS según las instrucciones de Render

---

## 🆘 Solución de Problemas

### Error: "Build failed"
- Verifica que el archivo `package.json` esté en la raíz
- Verifica que todos los archivos se hayan subido correctamente

### Error: "Application failed to start"
- Revisa los logs en Render
- Verifica que el archivo `server.js` esté en la raíz
- Verifica que la carpeta `public` exista con los HTML

### La aplicación no sincroniza datos
- Verifica que ambas páginas estén en el mismo dominio
- Abre la consola del navegador (F12) para ver errores
- El `window.storage` solo funciona en el entorno de Claude.ai
- Para Render, necesitarás implementar una base de datos real

### El visor no muestra usuarios
- Esto es porque `window.storage` no está disponible en Render
- Necesitarás implementar un backend con base de datos
- Puedo ayudarte a crear esa versión si lo necesitas

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs en Render (pestaña "Logs")
2. Verifica que todos los archivos estén en GitHub
3. Asegúrate de que la estructura de carpetas sea correcta

---

## 🎉 ¡Listo!

Tu sistema de graduación está ahora disponible en internet. Puedes compartir las URLs con tus usuarios y proyectar el visor en una pantalla durante la ceremonia.
