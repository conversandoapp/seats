const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// Configuración de Google Sheets
const SPREADSHEET_ID = '1MDNAmS98qoUlIJmrX2t2LyHV028J9iG7zoWNyRPJqCw';

// Obtener la fecha de hoy como nombre de hoja (dd-mm-yyyy) en zona horaria de Perú
function getTodaySheetName() {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return formatter.format(new Date()).replace(/\//g, '-');
}

// Validar que un nombre de hoja tenga formato dd-mm-yyyy
function isValidSheetDate(sheetName) {
    return /^\d{2}-\d{2}-\d{4}$/.test(sheetName);
}

// Clientes SSE conectados (para notificar al visor en tiempo real)
// Cada elemento: { res, date }
const sseClients = [];

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
async function fetchStudents(sheetName) {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return {};

    // Fila 0 = encabezados, filas 1+ = datos
    // Columnas: CODIGO, NOMBRES, APELLIDOS, CARRERA, BLOQUE, FILA, ASIENTO, ASISTENCIA
    const students = {};
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 7) continue;

        const [codigo, nombres, apellidos, carrera, bloque, fila, asiento] = row;
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
    }

    console.log(`Datos leídos: ${Object.keys(students).length} alumnos desde Google Sheets`);
    return students;
}

// Obtener asistencias desde Google Sheets (lectura directa de columna H)
async function fetchAttendanceFromSheet(sheetName) {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return [];

    const attendees = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 8) continue;

        const [codigo, nombres, apellidos, , bloque, fila, asiento, asistencia] = row;
        if (!asistencia || !asistencia.trim()) continue;

        const code = (codigo || '').trim().toLowerCase();
        if (!code) continue;

        const seatNumber = parseInt(asiento, 10);
        const rowNumber = parseInt(fila, 10);

        attendees.push({
            code,
            name: `${(nombres || '').trim()} ${(apellidos || '').trim()}`,
            seat: `${(bloque || '').trim()}-${seatNumber}`,
            block: (bloque || '').trim(),
            seatNumber: seatNumber,
            row: rowNumber,
            loginTime: asistencia.trim()
        });
    }

    return attendees;
}

// Escribir asistencia en Google Sheet con reintentos
async function writeAttendanceToSheet(sheetName, sheetRow, timestamp) {
    const MAX_RETRIES = 3;
    const BACKOFF_MS = [1000, 2000, 4000];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const sheets = getSheetsClient();
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!H${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[timestamp]]
                }
            });
            return true; // Escritura exitosa
        } catch (error) {
            console.error(`Intento ${attempt + 1}/${MAX_RETRIES} falló al escribir en Google Sheet:`, error.message);
            if (attempt < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
            }
        }
    }
    return false; // Todos los intentos fallaron
}

// Notificar a clientes SSE (solo a los que estén viendo la misma fecha)
function notifySSEClients(eventData) {
    const data = JSON.stringify(eventData);
    for (let i = sseClients.length - 1; i >= 0; i--) {
        try {
            if (sseClients[i].date === eventData.date) {
                sseClients[i].res.write(`event: attendance-update\ndata: ${data}\n\n`);
            }
        } catch (err) {
            sseClients.splice(i, 1);
        }
    }
}

// API: Listar todas las hojas con formato de fecha del spreadsheet
app.get('/api/sheets', async (req, res) => {
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });

        const sheetNames = response.data.sheets.map(s => s.properties.title);
        const dateSheets = sheetNames.filter(name => isValidSheetDate(name));

        res.json({ sheets: dateSheets });
    } catch (error) {
        console.error('Error al obtener lista de hojas:', error);
        res.status(500).json({ error: 'Error al obtener lista de hojas' });
    }
});

// API: Obtener todos los alumnos (con fecha opcional, default: hoy)
app.get('/api/students', async (req, res) => {
    try {
        const sheetName = req.query.date || getTodaySheetName();

        if (!isValidSheetDate(sheetName)) {
            return res.status(400).json({ error: 'Formato de fecha inválido. Use dd-mm-yyyy.' });
        }

        const students = await fetchStudents(sheetName);
        res.json(students);
    } catch (error) {
        console.error('Error al cargar datos de alumnos:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                error: 'No se encontró hoja para la fecha indicada',
                noSheet: true,
                sheetName: req.query.date || getTodaySheetName()
            });
        }

        res.status(500).json({ error: 'Error al cargar datos de alumnos desde Google Sheets' });
    }
});

// API: Buscar un alumno por código (con fecha opcional, default: hoy)
app.get('/api/students/:code', async (req, res) => {
    try {
        const code = req.params.code.trim().toLowerCase();
        const sheetName = req.query.date || getTodaySheetName();

        if (!isValidSheetDate(sheetName)) {
            return res.status(400).json({ error: 'Formato de fecha inválido. Use dd-mm-yyyy.' });
        }

        const students = await fetchStudents(sheetName);
        const student = students[code];

        if (!student) {
            return res.status(404).json({ error: 'Código de alumno no encontrado' });
        }

        res.json(student);
    } catch (error) {
        console.error('Error al buscar alumno:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                error: 'No hay ceremonia de graduación programada para hoy',
                noSheet: true
            });
        }

        res.status(500).json({ error: 'Error al buscar alumno en Google Sheets' });
    }
});

// API: Registrar asistencia (en la hoja de la fecha en que el alumno buscó su asiento)
app.post('/api/attendance', async (req, res) => {
    try {
        const { code, date } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, error: 'Campo requerido: code' });
        }

        // Usar la fecha enviada por el cliente si es válida, sino la de hoy
        const sheetName = (date && isValidSheetDate(date)) ? date : getTodaySheetName();

        const normalizedCode = code.trim().toLowerCase();
        const students = await fetchStudents(sheetName);
        const student = students[normalizedCode];

        if (!student) {
            return res.status(404).json({ success: false, error: 'Alumno no encontrado' });
        }

        const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        // Escribir en Google Sheet columna H (con 3 reintentos)
        const written = await writeAttendanceToSheet(sheetName, student.sheetRow, timestamp);

        if (!written) {
            console.error(`No se pudo escribir asistencia en Google Sheet para ${normalizedCode} después de 3 intentos`);
            return res.status(500).json({
                success: false,
                error: 'No se pudo registrar la asistencia. Por favor, intenta loguearte de nuevo.'
            });
        }

        // Notificar a los visores conectados por SSE (incluye fecha para filtrar)
        notifySSEClients({
            code: normalizedCode,
            name: student.name,
            seat: student.seat,
            timestamp,
            date: sheetName
        });

        console.log(`Asistencia registrada (${sheetName}): ${student.name} (${normalizedCode}) -> ${student.seat} a las ${timestamp}`);
        res.json({ success: true, timestamp });
    } catch (error) {
        console.error('Error registrando asistencia:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                success: false,
                error: 'No hay ceremonia de graduación programada para hoy'
            });
        }

        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// API: Obtener registros de asistencia (con fecha opcional, default: hoy)
app.get('/api/attendance', async (req, res) => {
    try {
        const sheetName = req.query.date || getTodaySheetName();

        if (!isValidSheetDate(sheetName)) {
            return res.status(400).json({ error: 'Formato de fecha inválido. Use dd-mm-yyyy.' });
        }

        const attendees = await fetchAttendanceFromSheet(sheetName);
        res.json({
            count: attendees.length,
            students: attendees,
            date: sheetName
        });
    } catch (error) {
        console.error('Error al obtener asistencia desde Google Sheets:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                count: 0,
                students: [],
                error: 'No se encontró hoja para la fecha indicada'
            });
        }

        res.status(500).json({ count: 0, students: [], error: 'Error al leer asistencia' });
    }
});

// SSE: Endpoint para eventos en tiempo real (filtrado por fecha)
app.get('/api/attendance/events', (req, res) => {
    const date = req.query.date || getTodaySheetName();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write(':connected\n\n');

    sseClients.push({ res, date });
    console.log(`Visor SSE conectado (${date}). Total clientes: ${sseClients.length}`);

    req.on('close', () => {
        const index = sseClients.findIndex(c => c.res === res);
        if (index !== -1) {
            sseClients.splice(index, 1);
        }
        console.log(`Visor SSE desconectado. Total clientes: ${sseClients.length}`);
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
