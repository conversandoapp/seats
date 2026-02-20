const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// Puerto que usará Render
const PORT = process.env.PORT || 3000;

// Configuración de Google Sheets
const SPREADSHEET_ID = '1MDNAmS98qoUlIJmrX2t2LyHV028J9iG7zoWNyRPJqCw';

// Validar que un nombre de hoja tenga formato dd-mm-yyyy-G-E
// G = letra de graduación (A, B, C, ...), E = estado (A=Activo, D=Desactivo)
function isValidSheet(sheetName) {
    return /^\d{2}-\d{2}-\d{4}-[A-Z]-[AD]$/.test(sheetName);
}

// Extraer información estructurada del nombre de hoja
function parseSheetInfo(sheetName) {
    const m = sheetName.match(/^(\d{2}-\d{2}-\d{4})-([A-Z])-([AD])$/);
    if (!m) return null;
    return {
        name: sheetName,
        date: m[1],
        graduation: m[2],
        state: m[3],
        active: m[3] === 'A'
    };
}

// Clientes SSE conectados (para notificar al visor en tiempo real)
// Cada elemento: { res, sheet }
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

// Notificar a clientes SSE (solo a los que estén viendo la misma hoja)
function notifySSEClients(eventData) {
    const data = JSON.stringify(eventData);
    for (let i = sseClients.length - 1; i >= 0; i--) {
        try {
            if (sseClients[i].sheet === eventData.sheet) {
                sseClients[i].res.write(`event: attendance-update\ndata: ${data}\n\n`);
            }
        } catch (err) {
            sseClients.splice(i, 1);
        }
    }
}

// API: Listar todas las hojas de graduación del spreadsheet
app.get('/api/sheets', async (req, res) => {
    try {
        const sheets = getSheetsClient();
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });

        const allNames = response.data.sheets.map(s => s.properties.title);
        const result = allNames.filter(isValidSheet).map(parseSheetInfo);

        res.json({ sheets: result });
    } catch (error) {
        console.error('Error al obtener lista de hojas:', error);
        res.status(500).json({ error: 'Error al obtener lista de hojas' });
    }
});

// API: Cambiar estado de una hoja (renombrar para activar/desactivar)
app.post('/api/sheets/set-state', async (req, res) => {
    try {
        const { sheetName, state } = req.body;

        if (!sheetName || !isValidSheet(sheetName) || !['A', 'D'].includes(state)) {
            return res.status(400).json({ error: 'Parámetros inválidos. Se requiere sheetName (dd-mm-yyyy-G-E) y state (A|D).' });
        }

        const info = parseSheetInfo(sheetName);
        const newName = `${info.date}-${info.graduation}-${state}`;

        if (newName === sheetName) {
            return res.json({ success: true, newName }); // Sin cambio necesario
        }

        const sheetsClient = getSheetsClient();

        // Obtener ID numérico de la hoja
        const meta = await sheetsClient.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties'
        });

        const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            return res.status(404).json({ error: 'Hoja no encontrada en el spreadsheet' });
        }

        // Renombrar la hoja
        await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    updateSheetProperties: {
                        properties: {
                            sheetId: sheet.properties.sheetId,
                            title: newName
                        },
                        fields: 'title'
                    }
                }]
            }
        });

        console.log(`Hoja renombrada: ${sheetName} → ${newName}`);
        res.json({ success: true, newName });
    } catch (error) {
        console.error('Error al cambiar estado de hoja:', error);
        res.status(500).json({ error: 'Error al cambiar estado de la hoja' });
    }
});

// API: Obtener todos los alumnos de una hoja específica (parámetro: sheet=dd-mm-yyyy-G-E)
app.get('/api/students', async (req, res) => {
    try {
        const sheetName = req.query.sheet;

        if (!sheetName || !isValidSheet(sheetName)) {
            return res.status(400).json({ error: 'Parámetro sheet inválido. Use formato dd-mm-yyyy-G-E.' });
        }

        const students = await fetchStudents(sheetName);
        res.json(students);
    } catch (error) {
        console.error('Error al cargar datos de alumnos:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                error: 'No se encontró hoja para el parámetro indicado',
                noSheet: true,
                sheetName: req.query.sheet
            });
        }

        res.status(500).json({ error: 'Error al cargar datos de alumnos desde Google Sheets' });
    }
});

// API: Buscar un alumno por código (busca en TODAS las hojas activas)
app.get('/api/students/:code', async (req, res) => {
    try {
        const code = req.params.code.trim().toLowerCase();

        // Obtener todas las hojas del spreadsheet
        const sheetsClient = getSheetsClient();
        const meta = await sheetsClient.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });

        const activeSheets = meta.data.sheets
            .map(s => s.properties.title)
            .filter(isValidSheet)
            .map(parseSheetInfo)
            .filter(s => s.active);

        if (activeSheets.length === 0) {
            return res.status(404).json({
                error: 'No hay ceremonias de graduación activas',
                noSheet: true
            });
        }

        // Buscar el alumno en cada hoja activa
        for (const sheet of activeSheets) {
            try {
                const students = await fetchStudents(sheet.name);
                if (students[code]) {
                    return res.json({ ...students[code], sheetName: sheet.name });
                }
            } catch (sheetError) {
                console.warn(`Error al leer hoja ${sheet.name}:`, sheetError.message);
            }
        }

        return res.status(404).json({ error: 'Código de alumno no encontrado' });
    } catch (error) {
        console.error('Error al buscar alumno:', error);
        res.status(500).json({ error: 'Error al buscar alumno en Google Sheets' });
    }
});

// API: Registrar asistencia (en la hoja indicada por el parámetro sheet)
app.post('/api/attendance', async (req, res) => {
    try {
        const { code, sheet } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, error: 'Campo requerido: code' });
        }
        if (!sheet || !isValidSheet(sheet)) {
            return res.status(400).json({ success: false, error: 'Campo requerido: sheet (formato dd-mm-yyyy-G-E)' });
        }

        // Verificar que la fecha/hoja esté activa antes de registrar asistencia
        const sheetInfo = parseSheetInfo(sheet);
        if (!sheetInfo || !sheetInfo.active) {
            return res.status(403).json({
                success: false,
                error: 'La fecha de graduación no está activa. No es posible registrar asistencia.',
                inactive: true
            });
        }

        const normalizedCode = code.trim().toLowerCase();
        const students = await fetchStudents(sheet);
        const student = students[normalizedCode];

        if (!student) {
            return res.status(404).json({ success: false, error: 'Alumno no encontrado' });
        }

        const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        // Escribir en Google Sheet columna H (con 3 reintentos)
        const written = await writeAttendanceToSheet(sheet, student.sheetRow, timestamp);

        if (!written) {
            console.error(`No se pudo escribir asistencia en Google Sheet para ${normalizedCode} después de 3 intentos`);
            return res.status(500).json({
                success: false,
                error: 'No se pudo registrar la asistencia. Por favor, intenta loguearte de nuevo.'
            });
        }

        // Notificar a los visores conectados por SSE
        notifySSEClients({
            code: normalizedCode,
            name: student.name,
            seat: student.seat,
            timestamp,
            sheet
        });

        console.log(`Asistencia registrada (${sheet}): ${student.name} (${normalizedCode}) -> ${student.seat} a las ${timestamp}`);
        res.json({ success: true, timestamp });
    } catch (error) {
        console.error('Error registrando asistencia:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                success: false,
                error: 'No se encontró la hoja de graduación indicada'
            });
        }

        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// API: Obtener registros de asistencia de una hoja específica (parámetro: sheet=dd-mm-yyyy-G-E)
app.get('/api/attendance', async (req, res) => {
    try {
        const sheetName = req.query.sheet;

        if (!sheetName || !isValidSheet(sheetName)) {
            return res.status(400).json({ error: 'Parámetro sheet inválido. Use formato dd-mm-yyyy-G-E.' });
        }

        const attendees = await fetchAttendanceFromSheet(sheetName);
        res.json({
            count: attendees.length,
            students: attendees,
            sheet: sheetName
        });
    } catch (error) {
        console.error('Error al obtener asistencia desde Google Sheets:', error);

        if (error.message && error.message.includes('Unable to parse range')) {
            return res.status(404).json({
                count: 0,
                students: [],
                error: 'No se encontró hoja para el parámetro indicado'
            });
        }

        res.status(500).json({ count: 0, students: [], error: 'Error al leer asistencia' });
    }
});

// SSE: Endpoint para eventos en tiempo real (filtrado por hoja)
app.get('/api/attendance/events', (req, res) => {
    const sheet = req.query.sheet;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write(':connected\n\n');

    sseClients.push({ res, sheet });
    console.log(`Visor SSE conectado (${sheet}). Total clientes: ${sseClients.length}`);

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
