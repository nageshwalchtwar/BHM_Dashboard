import React, { useState, useEffect } from 'react';
import './App.css';

interface SensorData {
  _id: string;
  sensorId: string;
  temperature: number;
  vibration: number;
  timestamp: Date;
}

function App() {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSensorData();
    // Fetch data every 5 seconds
    const interval = setInterval(fetchSensorData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSensorData = async () => {
    try {
      const response = await fetch('/api/data/sensors');
      if (!response.ok) {
        throw new Error('Failed to fetch sensor data');
      }
      const data = await response.json();
      setSensorData(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const getLatestData = () => {
    if (sensorData.length === 0) return null;
    return sensorData[sensorData.length - 1];
  };

  const getAverageTemperature = () => {
    if (sensorData.length === 0) return 0;
    const sum = sensorData.reduce((acc, data) => acc + data.temperature, 0);
    return (sum / sensorData.length).toFixed(1);
  };

  const getAverageVibration = () => {
    if (sensorData.length === 0) return 0;
    const sum = sensorData.reduce((acc, data) => acc + data.vibration, 0);
    return (sum / sensorData.length).toFixed(2);
  };

  const getHealthStatus = () => {
    const latest = getLatestData();
    if (!latest) return 'Unknown';
    
    if (latest.temperature > 80 || latest.vibration > 10) {
      return 'Critical';
    } else if (latest.temperature > 60 || latest.vibration > 5) {
      return 'Warning';
    }
    return 'Good';
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="header">
          <h1>🔧 BHM Dashboard</h1>
          <p>Bearing Health Monitoring System</p>
        </div>
        <div style={{ textAlign: 'center', color: 'white', fontSize: '18px' }}>
          Loading sensor data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="header">
          <h1>🔧 BHM Dashboard</h1>
          <p>Bearing Health Monitoring System</p>
        </div>
        <div style={{ textAlign: 'center', color: '#ff6b6b', fontSize: '18px' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  const latest = getLatestData();
  const healthStatus = getHealthStatus();

  return (
    <div className="dashboard">
      <div className="header">
        <h1>🔧 BHM Dashboard</h1>
        <p>Bearing Health Monitoring System</p>
        <p>Last Updated: {latest ? new Date(latest.timestamp).toLocaleString() : 'N/A'}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Current Temperature</h3>
          <p className="value">{latest ? `${latest.temperature}°C` : 'N/A'}</p>
        </div>
        
        <div className="stat-card">
          <h3>Current Vibration</h3>
          <p className="value">{latest ? `${latest.vibration} mm/s` : 'N/A'}</p>
        </div>
        
        <div className="stat-card">
          <h3>Average Temperature</h3>
          <p className="value">{getAverageTemperature()}°C</p>
        </div>
        
        <div className="stat-card">
          <h3>Average Vibration</h3>
          <p className="value">{getAverageVibration()} mm/s</p>
        </div>
        
        <div className="stat-card">
          <h3>Health Status</h3>
          <p className="value" style={{
            color: healthStatus === 'Good' ? '#4ecdc4' : 
                   healthStatus === 'Warning' ? '#ffe66d' : '#ff6b6b'
          }}>
            {healthStatus}
          </p>
        </div>
        
        <div className="stat-card">
          <h3>Total Readings</h3>
          <p className="value">{sensorData.length}</p>
        </div>
      </div>

      <div className="chart-container">
        <h2 className="chart-title">Recent Sensor Readings</h2>
        {sensorData.length > 0 ? (
          <div style={{ color: 'white' }}>
            <p>Latest 5 readings:</p>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              {sensorData.slice(-5).map((data, index) => (
                <div key={data._id} style={{ marginBottom: '8px' }}>
                  {index + 1}. {new Date(data.timestamp).toLocaleTimeString()} - 
                  Temp: {data.temperature}°C, Vibration: {data.vibration} mm/s
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: 'white' }}>No sensor data available</p>
        )}
      </div>
    </div>
  );
}

export default App;
