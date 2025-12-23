"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  Thermometer, 
  Zap, 
  TrendingUp, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Database,
  Wifi,
  WifiOff
} from "lucide-react"
import { LatestDataChart } from "@/components/latest-data-chart"
import { TemperatureChart } from "@/components/temperature-chart"
import { VibrationChart } from "@/components/vibration-chart"
import { StrainChart } from "@/components/strain-chart"
import { AccelerometerChart } from "@/components/accelerometer-chart"

interface SensorData {
  timestamp: number
  device: string
  vibration: number
  acceleration: number
  strain: number
  temperature: number
  x: number
  y: number
  z: number
}

interface DashboardStats {
  totalDataPoints: number
  latestTimestamp: string
  dataSource: string
  healthStatus: 'healthy' | 'warning' | 'error'
  lastUpdate: string
}

export default function BHMDashboard() {
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalDataPoints: 0,
    latestTimestamp: '',
    dataSource: '',
    healthStatus: 'healthy',
    lastUpdate: ''
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchData = async () => {
    setConnectionStatus('connecting')
    try {
      const response = await fetch('/api/csv-data-real?minutes=60')
      const result = await response.json()
      
      if (result.success && result.data) {
        setSensorData(result.data)
        setStats({
          totalDataPoints: result.metadata.totalPoints,
          latestTimestamp: result.metadata.latestDataTime || 'No data',
          dataSource: result.metadata.filename || 'Google Drive',
          healthStatus: 'healthy',
          lastUpdate: new Date().toLocaleString()
        })
        setError(null)
        setConnectionStatus('connected')
      } else {
        throw new Error(result.error || result.message || 'Failed to fetch data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setConnectionStatus('disconnected')
      setStats(prev => ({...prev, healthStatus: 'error'}))
    } finally {
      setLoading(false)
    }
  }

  const getLatestValues = () => {
    if (sensorData.length === 0) return null
    const latest = sensorData[0]
    return {
      vibration: latest.vibration?.toFixed(2) || 'N/A',
      temperature: latest.temperature?.toFixed(1) || 'N/A',
      strain: latest.strain?.toFixed(0) || 'N/A',
      acceleration: Math.sqrt(latest.x**2 + latest.y**2 + latest.z**2)?.toFixed(3) || 'N/A'
    }
  }

  const latestValues = getLatestValues()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Bridge Health Monitoring
            </h1>
            <p className="text-muted-foreground mt-2">
              Real-time structural health monitoring dashboard
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : connectionStatus === 'connecting' ? (
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            
            <Button 
              onClick={fetchData} 
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Connection Error Alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* System Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Points</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDataPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                From {stats.dataSource}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              {stats.healthStatus === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : stats.healthStatus === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{stats.healthStatus}</div>
              <p className="text-xs text-muted-foreground">
                Last update: {stats.lastUpdate}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Reading</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.latestTimestamp ? new Date(stats.latestTimestamp).toLocaleTimeString() : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.latestTimestamp ? new Date(stats.latestTimestamp).toLocaleDateString() : 'No data available'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto Refresh</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? "ON" : "OFF"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Updates every 30s
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live Values Cards */}
        {latestValues && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">Vibration</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-800">{latestValues.vibration}</div>
                <p className="text-xs text-blue-600">Hz</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Temperature</CardTitle>
                <Thermometer className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-800">{latestValues.temperature}</div>
                <p className="text-xs text-red-600">°C</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Strain</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-800">{latestValues.strain}</div>
                <p className="text-xs text-green-600">με</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Acceleration</CardTitle>
                <Zap className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-800">{latestValues.acceleration}</div>
                <p className="text-xs text-purple-600">g</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Section */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="vibration">Vibration</TabsTrigger>
            <TabsTrigger value="strain">Strain</TabsTrigger>
            <TabsTrigger value="acceleration">Acceleration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Sensor Data Overview</CardTitle>
                <CardDescription>
                  Live data from bridge monitoring sensors - Last 60 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <LatestDataChart 
                  data={sensorData} 
                  loading={loading}
                  showLegend={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="temperature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Temperature Monitoring</CardTitle>
                <CardDescription>
                  Structural temperature measurements over time
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <TemperatureChart data={sensorData} loading={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vibration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vibration Analysis</CardTitle>
                <CardDescription>
                  Bridge vibration frequency analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <VibrationChart data={sensorData} loading={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="strain" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Structural Strain</CardTitle>
                <CardDescription>
                  Strain measurements indicating structural stress
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <StrainChart data={sensorData} loading={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acceleration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>3-Axis Accelerometer Data</CardTitle>
                <CardDescription>
                  X, Y, Z acceleration measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} loading={loading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-800">Bridge Health Monitoring System</h3>
                <p className="text-sm text-blue-600">
                  Real-time monitoring with automatic data synchronization from Google Drive
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Live Data
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}