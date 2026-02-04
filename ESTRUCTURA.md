# 📁 Estructura de Archivos para GitHub

## Copia estos archivos a tu repositorio en el siguiente orden:

```
sistema-graduacion-laureate/          ← Carpeta raíz de tu proyecto
│
├── server.js                         ← Servidor Node.js/Express
├── package.json                      ← Dependencias del proyecto
├── .gitignore                        ← Archivos que Git debe ignorar
├── README.md                         ← Documentación del proyecto
│
└── public/                           ← Carpeta para archivos estáticos
    ├── graduacion-asientos.html      ← Sistema principal
    └── visor-tiempo-real.html        ← Visor en tiempo real
```

## ✅ Checklist antes de subir a GitHub:

- [ ] Archivo `server.js` en la raíz
- [ ] Archivo `package.json` en la raíz
- [ ] Archivo `.gitignore` en la raíz
- [ ] Archivo `README.md` en la raíz
- [ ] Carpeta `public/` creada
- [ ] Archivo `graduacion-asientos.html` dentro de `public/`
- [ ] Archivo `visor-tiempo-real.html` dentro de `public/`

## 🚀 Comando rápido para verificar estructura (Linux/Mac):

```bash
tree -L 2 -I node_modules
```

Deberías ver exactamente la estructura mostrada arriba.

## 📝 Archivos que tienes que crear:

Todos los archivos necesarios ya fueron generados y están disponibles para descargar.

## ⚠️ IMPORTANTE:

**NO olvides crear la carpeta `public/`** - sin ella, Render no encontrará tus archivos HTML.

## 🎯 URLs después del despliegue:

Cuando tu aplicación esté en Render:

- Sistema Principal: `https://tu-app.onrender.com/`
- Visor: `https://tu-app.onrender.com/visor`

## 💡 Tip:

Si usas Visual Studio Code:
1. Abre la carpeta del proyecto
2. En el explorador de archivos, verifica que veas esta estructura
3. Usa la extensión "GitLens" para facilitar el trabajo con Git
