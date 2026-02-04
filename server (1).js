const express = require('express');
const path = require('path');
const app = express();

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para la página principal (sistema de graduación)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'graduacion-asientos.html'));
});

// Ruta para el visor en tiempo real
app.get('/visor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'visor-tiempo-real.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log(`Sistema de graduación: http://localhost:${PORT}/`);
    console.log(`Visor en tiempo real: http://localhost:${PORT}/visor`);
});
