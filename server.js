const express = require('express');
const path = require('path');
const app = express();

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// Configuración de Google Sheets
const SPREADSHEET_ID = '1MDNAmS98qoUlIJmrX2t2LyHV028J9iG7zoWNyRPJqCw';
const SHEET_NAME = 'Grad1';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

// Cache de datos de alumnos
let studentCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Parser simple de CSV
function parseCSV(text) {
    const lines = text.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = [];
        let inQuotes = false;
        let current = '';

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                    current += '"';
                    j++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim());
        result.push(row);
    }

    return result;
}

// Obtener datos de alumnos desde Google Sheets
async function fetchStudents() {
    const now = Date.now();
    if (studentCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return studentCache;
    }

    const response = await fetch(CSV_URL);
    if (!response.ok) {
        throw new Error(`Error al obtener spreadsheet: ${response.status}`);
    }

    const text = await response.text();
    const rows = parseCSV(text);

    // Columnas: CODIGO, NOMBRES, APELLIDOS, CARRERA, BLOQUE, FILA, ASIENTO
    const students = {};
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 7) continue;

        const [codigo, nombres, apellidos, carrera, bloque, fila, asiento] = row;
        const code = codigo.trim().toLowerCase();
        if (!code) continue;

        const seatNumber = parseInt(asiento, 10);
        const rowNumber = parseInt(fila, 10);

        students[code] = {
            name: `${nombres.trim()} ${apellidos.trim()}`,
            seat: `${bloque.trim()}-${seatNumber}`,
            block: bloque.trim(),
            seatNumber: seatNumber,
            row: rowNumber,
            carrera: carrera.trim()
        };
    }

    studentCache = students;
    cacheTimestamp = now;
    console.log(`Datos cargados: ${Object.keys(students).length} alumnos desde Google Sheets`);

    return students;
}

// API endpoint para datos de alumnos
app.get('/api/students', async (req, res) => {
    try {
        const students = await fetchStudents();
        res.json(students);
    } catch (error) {
        console.error('Error al cargar datos de alumnos:', error);
        res.status(500).json({ error: 'Error al cargar datos de alumnos desde Google Sheets' });
    }
});

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
