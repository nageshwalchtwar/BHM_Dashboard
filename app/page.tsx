
"use client"
export const dynamic = 'force-dynamic'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  WifiOff,
  LogOut,
  User
} from "lucide-react"
import { LatestDataChart } from "@/components/latest-data-chart"
import { TemperatureChart } from "@/components/temperature-chart"
import { StrainChart } from "@/components/strain-chart"
import { AccelerometerChart } from "@/components/accelerometer-chart"
import { ADXLChart } from "@/components/adxl-chart"
import { WT901Chart } from "@/components/wt901-chart"
import { DeviceSelector } from "@/components/device-selector"

interface SensorData {
  timestamp: string  // Changed from number to string to match CSV format
  accel_x: number
  accel_y: number
  accel_z: number
  stroke_mm: number  // Renamed from strain to match CSV
  temperature_c: number  // Renamed from temperature to match CSV
  // Computed fields
  acceleration?: number  // Will be calculated from accel_x,accel_y,accel_z
  vibration?: number     // Will be calculated from acceleration
}

interface DashboardStats {
  totalDataPoints: number
  latestTimestamp: string
  dataSource: string
  healthStatus: 'healthy' | 'warning' | 'error'
  lastUpdate: string
}

export default function BHMDashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
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
  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  // Device selector state
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined)
  const [timeRange, setTimeRange] = useState<string>('1') // Default to 1 minute

  // Set mounted state and check authentication
  useEffect(() => {
    setMounted(true)
    
    // Check authentication
    const isLoggedIn = localStorage.getItem('bhm_authenticated') === 'true'
    const user = localStorage.getItem('bhm_user')
    
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    
    setIsAuthenticated(true)
    setCurrentUser(user)
  }, [router])

  // Auto-refresh data every 30 seconds and when time range or device changes
  useEffect(() => {
    fetchData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, timeRange, selectedDevice]) // Add selectedDevice dependency

  const fetchData = async () => {
    setConnectionStatus('connecting')
    try {
      let apiUrl = `/api/csv-data-real?minutes=${timeRange}`
      if (selectedDevice) {
        apiUrl += `&device=${selectedDevice}`
      }
      
      const response = await fetch(apiUrl)
      const result = await response.json()
      
      if (result.success && result.data) {
        setSensorData(result.data)
        setStats({
          totalDataPoints: result.metadata.totalPoints,
          latestTimestamp: result.data.length > 0 && result.data[0].rawTimestamp ? 
            result.data[0].rawTimestamp : 
            (result.data.length > 0 ? new Date(result.data[0].timestamp).toLocaleTimeString('en-US', { hour12: false }) : 'No data'),
          dataSource: result.metadata.device ? 
            `${result.metadata.device.name} (${result.metadata.filename || 'Google Drive'})` : 
            result.metadata.filename || 'Google Drive',
          healthStatus: 'healthy',
          lastUpdate: mounted ? new Date().toLocaleString() : ''
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

  const runDebugTest = async () => {
    try {
      setLoading(true)
      console.log('🔧 Running comprehensive Google Drive debug...')
      
      const response = await fetch('/api/debug-drive')
      const result = await response.json()
      
      setDebugInfo(result)
      console.log('Debug results:', result)
      
    } catch (err) {
      console.error('Debug test failed:', err)
      setDebugInfo({
        error: 'Debug test failed',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Returns latest values from the latest data point
  const getLatestValues = () => {
    if (sensorData.length === 0) return null
    const latest = sensorData[0]
    const acceleration = Math.sqrt(latest.accel_x**2 + latest.accel_y**2 + latest.accel_z**2)
    return {
      vibration: acceleration?.toFixed(2) || 'N/A',  // Use acceleration as vibration
      temperature: latest.temperature_c?.toFixed(1) || 'N/A',
      strain: latest.stroke_mm?.toFixed(2) || 'N/A',  // Use stroke_mm as strain
      acceleration: acceleration?.toFixed(3) || 'N/A'
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('bhm_authenticated')
    localStorage.removeItem('bhm_user')
    localStorage.removeItem('bhm_login_time')
    router.push('/login')
  }

  const handleDeviceChange = (deviceId: string | undefined) => {
    setSelectedDevice(deviceId)
    setError(null) // Clear any previous errors
    fetchData() // Immediately fetch data for new device
  }

  const handleAdminClick = () => {
    router.push('/admin')
  }

  // Don't render anything until authentication is checked
  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
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
            <p className="text-muted-foreground mt-1">
              Real-time structural health monitoring system
            </p>
          </div>
          
          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4" />
              <span>Welcome, {currentUser}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>

        {/* Connection Status and Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
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
            
            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time Range:</span>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 1 minute</SelectItem>
                  <SelectItem value="5">Last 5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">            <Button 
              onClick={fetchData} 
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button 
              onClick={runDebugTest} 
              disabled={loading}
              size="sm"
              variant="secondary"
            >
              <AlertTriangle className={`h-4 w-4 mr-2`} />
              Debug
            </Button>
          </div>
        </div>

        {/* Device Selector */}
        <DeviceSelector 
          selectedDevice={selectedDevice}
          onDeviceChange={handleDeviceChange}
          onAdminClick={handleAdminClick}
          className="max-w-2xl"
        />

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

        {/* Debug Results */}
        {debugInfo && (
          <Alert variant={debugInfo.summary?.overallStatus === 'PARTIAL_SUCCESS' ? 'default' : 'destructive'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Google Drive Debug Results</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2">
                <div>
                  <strong>Status:</strong> {debugInfo.summary?.overallStatus || 'Unknown'}
                </div>
                <div>
                  <strong>Tests:</strong> {debugInfo.summary?.passedTests || 0}/{debugInfo.summary?.totalTests || 0} passed
                </div>
                
                {debugInfo.tests && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">View Test Details</summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {debugInfo.tests.map((test: any, index: number) => (
                        <div key={index} className="p-2 border rounded">
                          <div className="flex justify-between">
                            <span className="font-medium">{test.name}</span>
                            <Badge variant={test.status === 'PASS' ? 'default' : 'destructive'}>
                              {test.status}
                            </Badge>
                          </div>
                          <div className="text-xs mt-1">{test.details}</div>
                          {test.contentPreview && (
                            <div className="text-xs mt-1 bg-gray-100 p-1 rounded">
                              Preview: {test.contentPreview}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                
                {debugInfo.summary?.recommendation && (
                  <div className="mt-2">
                    <strong>Recommendation:</strong> {debugInfo.summary.recommendation}
                  </div>
                )}
              </div>
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
                Filtered: {sensorData.length.toLocaleString()} from {timeRange} min
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
                Last update: {mounted ? (stats.lastUpdate || new Date().toLocaleString()) : 'Loading...'}
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
                {mounted && stats.latestTimestamp ? new Date(stats.latestTimestamp).toLocaleTimeString() : (mounted ? 'N/A' : 'Loading...')}
              </div>
              <div className="text-sm text-muted-foreground">
                {mounted && stats.latestTimestamp ? new Date(stats.latestTimestamp).toLocaleDateString() : (mounted ? 'No data available' : 'Loading...')}
              </div>
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

        {/* Live Values Cards - Only CSV Columns (excluding Device) */}
        {latestValues && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Temperature_C</CardTitle>
                <Thermometer className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-800">
                  {sensorData.length > 0 ? (sensorData[0].temperature_c?.toFixed(2) || '0.00') : 'N/A'}
                </div>
                <p className="text-xs text-red-600">°C</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Stroke_mm</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-800">
                  {sensorData.length > 0 ? (sensorData[0].stroke_mm?.toFixed(2) || '0.00') : 'N/A'}
                </div>
                <p className="text-xs text-green-600">mm</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">X</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-800">{sensorData.length > 0 ? sensorData[0].accel_x?.toFixed(3) : 'N/A'}</div>
                <p className="text-xs text-blue-600">g</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-yellow-700">Y</CardTitle>
                <Zap className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-800">{sensorData.length > 0 ? sensorData[0].accel_y?.toFixed(3) : 'N/A'}</div>
                <p className="text-xs text-yellow-600">g</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Z</CardTitle>
                <Activity className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-800">{sensorData.length > 0 ? sensorData[0].accel_z?.toFixed(3) : 'N/A'}</div>
                <p className="text-xs text-purple-600">g</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Section - Only CSV Columns */}
        <Tabs defaultValue="temperature" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2 mb-2">
            <TabsTrigger value="temperature" asChild>
              <Button variant="secondary" className="min-w-[120px]">Temperature</Button>
            </TabsTrigger>
            <TabsTrigger value="stroke" asChild>
              <Button variant="secondary" className="min-w-[120px]">LVDT</Button>
            </TabsTrigger>
            <TabsTrigger value="adxl-xyz" asChild>
              <Button variant="outline" className="min-w-[140px]">ADXL (X,Y,Z)</Button>
            </TabsTrigger>
            <TabsTrigger value="wt901-xyz" asChild>
              <Button variant="outline" className="min-w-[140px]">WT901 (X,Y,Z)</Button>
            </TabsTrigger>
            <TabsTrigger value="accel-x" asChild>
              <Button variant="secondary" className="min-w-[100px]">accele_x</Button>
            </TabsTrigger>
            <TabsTrigger value="accel-y" asChild>
              <Button variant="secondary" className="min-w-[100px]">accele_y</Button>
            </TabsTrigger>
            <TabsTrigger value="accel-z" asChild>
              <Button variant="secondary" className="min-w-[100px]">accele_z</Button>
            </TabsTrigger>
            <TabsTrigger value="accel-xyz" asChild>
              <Button variant="outline" className="min-w-[160px]">Accelerometer (x, y, z)</Button>
            </TabsTrigger>
                    {/* Remove combined accelerometer plot for now, or implement with Recharts if needed */}
          </TabsList>
          <TabsContent value="temperature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Temperature</CardTitle>
                <CardDescription>
                  Temperature measurements in Celsius
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <TemperatureChart data={sensorData} isLoading={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stroke" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>LVDT</CardTitle>
                <CardDescription>
                  LVDT displacement measurements in millimeters
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <StrainChart data={sensorData} isLoading={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adxl-xyz" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ADXL Accelerometer (X, Y, Z)</CardTitle>
                <CardDescription>
                  ADXL accelerometer measurements across all three axes
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <ADXLChart data={sensorData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wt901-xyz" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WT901 Accelerometer (X, Y, Z)</CardTitle>
                <CardDescription>
                  WT901 accelerometer measurements across all three axes
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <WT901Chart data={sensorData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accel-x" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>accele_x</CardTitle>
                <CardDescription>
                  X-axis acceleration measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="accel_x" title="accele_x" color="#3b82f6" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accel-y" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>accele_y</CardTitle>
                <CardDescription>
                  Y-axis acceleration measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="accel_y" title="accele_y" color="#f59e0b" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accel-z" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>accele_z</CardTitle>
                <CardDescription>
                  Z-axis acceleration measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="accel_z" title="accele_z" color="#8b5cf6" />
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