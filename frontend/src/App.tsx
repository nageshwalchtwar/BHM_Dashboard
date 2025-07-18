import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  Chip,
  Stack,
  useTheme,
  ThemeProvider,
  createTheme,
  Unstable_Grid2 as Grid2,
} from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import './App.css';

// CSS styles
const styles = {
  card: {
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    }
  },
  chart: {
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    }
  }
};

interface SensorData {
  timestamp: string;
  vibration: number;
  acceleration: number;
  strain: number;
  temperature: number;
  health: 'good' | 'warning' | 'critical';
}

// Create theme with blue palette
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f5f5f5'
    }
  }
});

function App() {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/sensors');
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'critical': return '#ff3d00';
      case 'warning': return '#ffa000';
      case 'good': return '#00c853';
      default: return '#757575';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'critical': return <WarningIcon fontSize="large" />;
      case 'warning': return <WarningIcon fontSize="large" />;
      case 'good': return <CheckCircleIcon fontSize="large" />;
      default: return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <AppBar position="static" color="primary">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Bridge Health Monitoring System
            </Typography>
            <IconButton color="inherit">
              <NotificationsIcon />
            </IconButton>
            <IconButton color="inherit">
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          {/* Status Cards */}
          <Grid2 container spacing={3}>
            <Grid2 xs={12} sm={6} md={3}>
              <Card sx={{ 
                bgcolor: getHealthColor(data[0]?.health || 'good'),
                color: 'white',
                height: '100%',
                ...styles.card
              }}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Health Status</Typography>
                    {getHealthIcon(data[0]?.health || 'good')}
                  </Box>
                  <Typography variant="h4" sx={{ mt: 2 }}>
                    {data[0]?.health.toUpperCase()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3} component="div">
              <Card sx={styles.card}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" color="textSecondary">Vibration</Typography>
                    <SpeedIcon color="primary" />
                  </Box>
                  <Typography variant="h4" sx={{ mt: 2 }}>
                    {data[0]?.vibration.toFixed(3)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    m/s²
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" color="textSecondary">Strain</Typography>
                    <SpeedIcon color="primary" />
                  </Box>
                  <Typography variant="h4" sx={{ mt: 2 }}>
                    {data[0]?.strain.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    µε
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" color="textSecondary">Temperature</Typography>
                    <DeviceThermostatIcon color="primary" />
                  </Box>
                  <Typography variant="h4" sx={{ mt: 2 }}>
                    {data[0]?.temperature.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    °C
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Vibration & Acceleration Trends</Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.slice(-24)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(timestamp: string) => new Date(timestamp).toLocaleTimeString()} 
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="vibration" 
                      stroke="#1976d2" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="acceleration" 
                      stroke="#2196f3" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Strain & Temperature Trends</Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.slice(-24)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(timestamp: string) => new Date(timestamp).toLocaleTimeString()} 
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="strain" 
                      stroke="#ff9800" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#f57c00" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
