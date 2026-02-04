# 🎓 Sistema de Graduación Laureate

Sistema de ubicación de asientos para ceremonias de graduación con visor en tiempo real.

## 🚀 Características

- **Sistema Principal**: Permite a los graduados buscar su asiento por código de alumno
- **Visor en Tiempo Real**: Panel de control que muestra todos los usuarios logueados en tiempo real
- **Sincronización**: Los datos se comparten automáticamente entre el sistema y el visor

## 📱 URLs del Sistema

- **Sistema de Graduación**: `https://tu-app.onrender.com/`
- **Visor en Tiempo Real**: `https://tu-app.onrender.com/visor`

## 🎨 Códigos de Prueba

| Código | Nombre | Asiento |
|--------|--------|---------|
| u200910086 | Juan Carrasco | A4 |
| u200910025 | Sergio Acuña | B7 |
| u200910101 | María González | A12 |
| u200910102 | Carlos Mendoza | C5 |
| u200910103 | Ana Rodríguez | D15 |
| u200910104 | Pedro Sánchez | E8 |
| u200910105 | Laura Martínez | F20 |
| u200910106 | Diego Fernández | G3 |
| u200910107 | Sofía Torres | H18 |
| u200910108 | Miguel Ramírez | I11 |
| u200910109 | Valentina Cruz | J6 |
| u200910110 | Javier López | K14 |
| u200910111 | Camila Vargas | L9 |
| u200910112 | Roberto Castillo | M2 |
| u200910113 | Isabella Morales | N16 |
| u200910114 | Fernando Gutiérrez | A25 |
| u200910115 | Daniela Rojas | B19 |
| u200910116 | Andrés Herrera | C22 |
| u200910117 | Gabriela Peña | D10 |
| u200910118 | Ricardo Flores | E28 |

## 🛠️ Instalación Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Modo desarrollo (con auto-reload)
npm run dev
```

## 📦 Despliegue en Render

1. Sube el código a GitHub
2. Conecta tu repositorio en Render
3. Render detectará automáticamente el proyecto Node.js
4. El servidor se iniciará con `npm start`

## 📄 Estructura del Proyecto

```
├── server.js                      # Servidor Express
├── package.json                   # Dependencias y scripts
├── public/
│   ├── graduacion-asientos.html  # Sistema principal
│   └── visor-tiempo-real.html    # Visor en tiempo real
└── README.md                      # Esta documentación
```

## 🎯 Uso

### Para Graduados:
1. Accede al sistema principal
2. Ingresa tu código de alumno (ej: u200910086)
3. El sistema te mostrará tu asiento asignado

### Para Administradores:
1. Abre el visor en tiempo real en una pantalla grande
2. Verás automáticamente todos los asientos de usuarios que se han logueado
3. El visor se actualiza cada 5 segundos

## 🎨 Personalización

El sistema está diseñado con los colores corporativos de Laureate:
- Color principal: Coral/Salmón (#FF6B54)
- Esquema profesional y formal para ceremonias universitarias

## 📝 Notas

- El sistema usa almacenamiento compartido del navegador para sincronizar datos
- Los datos persisten durante la sesión del navegador
- Para producción, considera implementar una base de datos real

## 👨‍💻 Desarrollo

Creado con:
- HTML5
- CSS3
- JavaScript (Vanilla)
- Express.js
- Node.js
