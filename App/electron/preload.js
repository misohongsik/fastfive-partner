const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getQueueStatus: () => ipcRenderer.invoke('get-queue-status'),
    getRecentLogs: () => ipcRenderer.invoke('get-recent-logs'),
    startCrawler: () => ipcRenderer.invoke('start-crawler'),
    stopCrawler: () => ipcRenderer.invoke('stop-crawler'),

    generateNaver: () => ipcRenderer.invoke('generate-naver'),
    uploadNaver: () => ipcRenderer.invoke('upload-naver'),

    generateCoupang: () => ipcRenderer.invoke('generate-coupang'),
    uploadCoupang: () => ipcRenderer.invoke('upload-coupang'),

    stopProcess: () => ipcRenderer.invoke('stop-process'),

    onLogReceived: (callback) => ipcRenderer.on('crawler-log', (_event, value) => callback(value)),
    // Add more methods here as needed
});
