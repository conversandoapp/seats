const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// Configuración de Google Sheets
const SPREADSHEET_ID = '1MDNAmS98qoUlIJmrX2t2LyHV028J9iG7zoWNyRPJqCw';
const SHEET_NAME = 'Grad1';

// Registro de asistencia en memoria (para el visor en tiempo real)
const attendanceMap = new Map();

// Cliente de Google Sheets API
function getSheetsClient() {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
}

// Obtener datos de alumnos desde Google Sheets (lectura directa, sin cache)
async function fetchStudents() {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return {};

    // Fila 0 = encabezados, filas 1+ = datos
    // Columnas: CODIGO, NOMBRES, APELLIDOS, CARRERA, BLOQUE, FILA, ASIENTO, ASISTENCIA
    const students = {};
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 7) continue;

        const [codigo, nombres, apellidos, carrera, bloque, fila, asiento, asistencia] = row;
        const code = (codigo || '').trim().toLowerCase();
        if (!code) continue;

        const seatNumber = parseInt(asiento, 10);
        const rowNumber = parseInt(fila, 10);

        students[code] = {
            name: `${(nombres || '').trim()} ${(apellidos || '').trim()}`,
            seat: `${(bloque || '').trim()}-${seatNumber}`,
            block: (bloque || '').trim(),
            seatNumber: seatNumber,
            row: rowNumber,
            carrera: (carrera || '').trim(),
            sheetRow: i + 1 // fila real en la hoja (1-indexed, +1 por encabezado)
        };

        // Recuperar asistencias previas desde la columna H
        if (asistencia && asistencia.trim()) {
            attendanceMap.set(code, {
                code,
                name: students[code].name,
                seat: students[code].seat,
                block: students[code].block,
                seatNumber: students[code].seatNumber,
                row: students[code].row,
                loginTime: asistencia.trim()
            });
        }
    }

    console.log(`Datos leídos: ${Object.keys(students).length} alumnos desde Google Sheets`);
    return students;
}

// API: Obtener todos los alumnos
app.get('/api/students', async (req, res) => {
    try {
        const students = await fetchStudents();
        res.json(students);
    } catch (error) {
        console.error('Error al cargar datos de alumnos:', error);
        res.status(500).json({ error: 'Error al cargar datos de alumnos desde Google Sheets' });
    }
});

// API: Buscar un alumno por código (tiempo real)
app.get('/api/students/:code', async (req, res) => {
    try {
        const code = req.params.code.trim().toLowerCase();
        const students = await fetchStudents();
        const student = students[code];

        if (!student) {
            return res.status(404).json({ error: 'Código de alumno no encontrado' });
        }

        res.json(student);
    } catch (error) {
        console.error('Error al buscar alumno:', error);
        res.status(500).json({ error: 'Error al buscar alumno en Google Sheets' });
    }
});

// API: Registrar asistencia
app.post('/api/attendance', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, error: 'Campo requerido: code' });
        }

        const normalizedCode = code.trim().toLowerCase();
        const students = await fetchStudents();
        const student = students[normalizedCode];

        if (!student) {
            return res.status(404).json({ success: false, error: 'Alumno no encontrado' });
        }

        const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        // Escribir en Google Sheet columna H
        try {
            const sheets = getSheetsClient();
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!H${student.sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[timestamp]]
                }
            });
        } catch (sheetError) {
            console.error('Error escribiendo en Google Sheet (asistencia guardada en memoria):', sheetError.message);
        }

        // Actualizar mapa en memoria (para el visor)
        attendanceMap.set(normalizedCode, {
            code: normalizedCode,
            name: student.name,
            seat: student.seat,
            block: student.block,
            seatNumber: student.seatNumber,
            row: student.row,
            loginTime: timestamp
        });

        console.log(`Asistencia registrada: ${student.name} (${normalizedCode}) -> ${student.seat} a las ${timestamp}`);
        res.json({ success: true, timestamp });
    } catch (error) {
        console.error('Error registrando asistencia:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// API: Obtener registros de asistencia (para el visor)
app.get('/api/attendance', (req, res) => {
    const students = Array.from(attendanceMap.values());
    res.json({
        count: students.length,
        students: students
    });
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
