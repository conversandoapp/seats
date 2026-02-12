const express = require('express');
const path = require('path');
const app = express();

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// --- Google Sheets config ---
const SPREADSHEET_ID = '1MDNAmS98qoUlIJmrX2t2LyHV028J9iG7zoWNyRPJqCw';
const SHEET_NAME = 'Grad1';
const SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// Cache en memoria (TTL de 5 minutos)
let studentsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// --- CSV parser ---
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return [];

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 6) {
            rows.push({
                codigo: values[0].trim().toLowerCase(),
                nombres: values[1].trim(),
                apellidos: values[2].trim(),
                carrera: values[3].trim(),
                bloque: values[4].trim().toUpperCase(),
                fila: parseInt(values[5].trim(), 10)
            });
        }
    }
    return rows;
}

// --- Transformar filas del spreadsheet al formato del frontend ---
function buildStudentDatabase(rows) {
    const SEATS_PER_ROW = 21;
    const seatCounters = {};
    const db = {};

    for (const row of rows) {
        if (!row.codigo || isNaN(row.fila)) continue;

        const key = `${row.bloque}-${row.fila}`;
        seatCounters[key] = (seatCounters[key] || 0) + 1;

        const seatNumber = (row.fila - 1) * SEATS_PER_ROW + seatCounters[key];
        const seat = `${row.bloque}-${seatNumber}`;

        db[row.codigo] = {
            name: `${row.nombres} ${row.apellidos}`,
            seat,
            block: row.bloque,
            seatNumber,
            row: row.fila,
            carrera: row.carrera
        };
    }
    return db;
}

// --- Endpoint para obtener datos de alumnos ---
app.get('/api/students', async (req, res) => {
    try {
        const now = Date.now();
        if (studentsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
            return res.json(studentsCache);
        }

        console.log('Fetching spreadsheet from Google Sheets...');
        const response = await fetch(SHEETS_CSV_URL, { redirect: 'follow' });

        if (!response.ok) {
            throw new Error(`Google Sheets respondió con status ${response.status}`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);
        const studentDatabase = buildStudentDatabase(rows);

        studentsCache = studentDatabase;
        cacheTimestamp = now;

        console.log(`Loaded ${Object.keys(studentDatabase).length} students from spreadsheet`);
        res.json(studentDatabase);
    } catch (error) {
        console.error('Error fetching spreadsheet:', error.message);

        if (studentsCache) {
            console.log('Returning cached data after error');
            return res.json(studentsCache);
        }

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
