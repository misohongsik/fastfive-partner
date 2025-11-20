import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [queueStatus, setQueueStatus] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const logsEndRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    const fetchData = async () => {
      if (window.electronAPI) {
        try {
          const status = await window.electronAPI.getQueueStatus();
          setQueueStatus(Array.isArray(status) ? status : []);
        } catch (error) {
          console.error("Failed to fetch data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback for browser dev mode
        setQueueStatus([
          { status: 'PENDING', count: 120 },
          { status: 'PROCESSING', count: 5 },
          { status: 'COMPLETED', count: 450 },
          { status: 'FAILED', count: 12 }
        ]);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    // Setup Log Listener
    if (window.electronAPI) {
      window.electronAPI.onLogReceived((log) => {
        setLogs(prevLogs => [...prevLogs, {
          timestamp: new Date().toISOString(),
          message: log.message,
          type: log.type,
          source: log.source
        }]);
      });
    }

    return () => clearInterval(interval);
  }, []);

  const handleStartCrawler = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.startCrawler();
      alert(result.message);
    } else {
      alert("Dev Mode: Start Crawler clicked");
    }
  };

  const handleStopCrawler = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.stopCrawler();
      alert(result.message);
    } else {
      alert("Dev Mode: Stop Crawler clicked");
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Amazon Crawler Control</h1>
        <div className="status-badge">Online</div>
      </header>

      <div className="stats-grid">
        {queueStatus.map((item, index) => (
          <div key={index} className={`stat-card ${item.status.toLowerCase()}`}>
            <h3>{item.status}</h3>
            <p className="stat-count">{item.count}</p>
          </div>
        ))}
      </div>

      <div className="main-content">
        <div className="control-panel">
          <h2>Crawler Control</h2>
          <div className="button-group">
            <button className="btn-primary" onClick={handleStartCrawler}>Start Crawler</button>
            <button className="btn-danger" onClick={handleStopCrawler}>Stop Crawler</button>
          </div>

          <h2>Naver Upload</h2>
          <div className="button-group">
            <button className="btn-secondary" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.generateNaver();
                alert(res.message);
              }
            }}>1. Generate Data</button>
            <button className="btn-primary" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.uploadNaver();
                alert(res.message);
              }
            }}>2. Upload to Store</button>
            <button className="btn-danger" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.stopProcess();
                alert(res.message);
              }
            }}>Stop</button>
          </div>

          <h2>Coupang Upload</h2>
          <div className="button-group">
            <button className="btn-secondary" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.generateCoupang();
                alert(res.message);
              }
            }}>1. Generate Data</button>
            <button className="btn-primary" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.uploadCoupang();
                alert(res.message);
              }
            }}>2. Upload to Store</button>
            <button className="btn-danger" onClick={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.stopProcess();
                alert(res.message);
              }
            }}>Stop</button>
          </div>
        </div>

        <div className="logs-panel">
          <h2>System Logs</h2>
          <div className="logs-window">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry ${log.type || ''}`}>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                {log.source && <span className="log-source">[{log.source}]</span>}
                <span className="log-message">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
