import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables from the parent directory (project root)
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let dbConnection;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
}

app.whenReady().then(async () => {
    await createWindow();

    // Database Connection
    try {
        dbConnection = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'amazon',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('✅ Database connected in Electron Main Process');
    } catch (err) {
        console.error('❌ Database connection failed:', err);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-queue-status', async () => {
    if (!dbConnection) return { error: 'Database not connected' };
    try {
        const [rows] = await dbConnection.query(
            'SELECT status, COUNT(*) as count FROM amazon_product_queue GROUP BY status'
        );
        return rows;
    } catch (error) {
        console.error('Error fetching queue status:', error);
        return { error: error.message };
    }
});

// Crawler Process Management
let crawlerProcess = null;

ipcMain.handle('start-crawler', async (event) => {
    if (crawlerProcess) return { success: false, message: 'Crawler is already running' };

    const scriptPath = path.join(__dirname, '..', '..', 'detail_crawler_proxy.js');
    const cwd = path.join(__dirname, '..', '..'); // Project root

    console.log(`🚀 Starting crawler: node ${scriptPath}`);

    const { spawn } = await import('child_process');
    crawlerProcess = spawn('node', [scriptPath], { cwd, shell: true });

    crawlerProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`[Crawler] ${message}`);
        if (mainWindow) mainWindow.webContents.send('crawler-log', { type: 'info', message });
    });

    crawlerProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        console.error(`[Crawler Error] ${message}`);
        if (mainWindow) mainWindow.webContents.send('crawler-log', { type: 'error', message });
    });

    crawlerProcess.on('close', (code) => {
        console.log(`[Crawler] Process exited with code ${code}`);
        if (mainWindow) mainWindow.webContents.send('crawler-log', { type: 'system', message: `Process exited with code ${code}` });
        crawlerProcess = null;
    });

    return { success: true, message: 'Crawler started' };
});

ipcMain.handle('stop-crawler', async () => {
    if (!crawlerProcess) return { success: false, message: 'No crawler running' };
    crawlerProcess.kill();
    crawlerProcess = null;
    return { success: true, message: 'Crawler stop signal sent' };
});

// Generic Process Management (for Naver/Coupang)
let activeProcess = null;
let activeProcessName = '';

async function runScript(scriptName, processLabel, eventName) {
    if (activeProcess) return { success: false, message: `Process '${activeProcessName}' is already running` };

    const scriptPath = path.join(__dirname, '..', '..', scriptName);
    const cwd = path.join(__dirname, '..', '..');

    console.log(`🚀 Starting ${processLabel}: node ${scriptPath}`);
    activeProcessName = processLabel;

    const { spawn } = await import('child_process');
    activeProcess = spawn('node', [scriptPath], { cwd, shell: true });

    activeProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`[${processLabel}] ${message}`);
        if (mainWindow) mainWindow.webContents.send(eventName, { type: 'info', message, source: processLabel });
    });

    activeProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        console.error(`[${processLabel} Error] ${message}`);
        if (mainWindow) mainWindow.webContents.send(eventName, { type: 'error', message, source: processLabel });
    });

    activeProcess.on('close', (code) => {
        console.log(`[${processLabel}] Process exited with code ${code}`);
        if (mainWindow) mainWindow.webContents.send(eventName, { type: 'system', message: `Process exited with code ${code}`, source: processLabel });
        activeProcess = null;
        activeProcessName = '';
    });

    return { success: true, message: `${processLabel} started` };
}

ipcMain.handle('generate-naver', () => runScript('Naver_Product_Upload.js', 'Naver-Gen', 'crawler-log'));
ipcMain.handle('upload-naver', () => runScript('Smartstore_Uploader.js', 'Naver-Upload', 'crawler-log'));
ipcMain.handle('generate-coupang', () => runScript('Coupang_Product_Transform.js', 'Coupang-Gen', 'crawler-log'));
ipcMain.handle('upload-coupang', () => runScript('Coupang_Uploader.js', 'Coupang-Upload', 'crawler-log'));

ipcMain.handle('stop-process', async () => {
    if (!activeProcess) return { success: false, message: 'No active process running' };
    activeProcess.kill();
    activeProcess = null;
    activeProcessName = '';
    return { success: true, message: 'Process stop signal sent' };
});

ipcMain.handle('get-recent-logs', async () => {
    // Placeholder: In a real app, you might read from a log file or a logs table
    return [
        { timestamp: new Date().toISOString(), message: 'App started' },
        { timestamp: new Date().toISOString(), message: 'Database connected' }
    ];
});
