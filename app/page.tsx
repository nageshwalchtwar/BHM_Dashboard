
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
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between py-2 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bridge Health Monitor
              </h1>
              <p className="text-sm text-gray-600">
                Real-time structural monitoring system
              </p>
            </div>
          </div>
          
          {/* User Info and Controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4 text-sm">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : connectionStatus === 'connecting' ? (
                  <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-gray-600">
                  {connectionStatus === 'connected' ? 'Live' : 
                   connectionStatus === 'connecting' ? 'Syncing...' : 'Offline'}
                </span>
              </div>
              
              {/* Time Range */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Range:</span>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1min</SelectItem>
                    <SelectItem value="5">5min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                onClick={fetchData} 
                disabled={loading}
                size="sm"
                variant="outline"
                className="h-8"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button 
                onClick={runDebugTest} 
                disabled={loading}
                size="sm"
                variant="ghost"
                className="h-8"
              >
                <AlertTriangle className="h-3 w-3" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="h-8 flex items-center space-x-1"
              >
                <User className="h-3 w-3" />
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Device Selector - Compact */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <DeviceSelector 
            selectedDevice={selectedDevice}
            onDeviceChange={handleDeviceChange}
            onAdminClick={handleAdminClick}
            className=""
          />
        </div>

        {/* Connection Error Alert - Compact */}
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">Error</AlertTitle>
            <AlertDescription className="text-sm">
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

        {/* Charts Section - Compact */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <Tabs defaultValue="temperature" className="w-full">
            <div className="border-b border-gray-200 px-4 py-2">
              <TabsList className="flex flex-wrap gap-1 bg-gray-50 p-1">
                <TabsTrigger value="temperature" className="text-xs px-3 py-1.5">Temperature</TabsTrigger>
                <TabsTrigger value="stroke" className="text-xs px-3 py-1.5">LVDT</TabsTrigger>
                <TabsTrigger value="adxl-x" className="text-xs px-3 py-1.5">ADXL X</TabsTrigger>
                <TabsTrigger value="adxl-y" className="text-xs px-3 py-1.5">ADXL Y</TabsTrigger>
                <TabsTrigger value="adxl-z" className="text-xs px-3 py-1.5">ADXL Z</TabsTrigger>
                <TabsTrigger value="wt901-x" className="text-xs px-3 py-1.5">WT901 X</TabsTrigger>
                <TabsTrigger value="wt901-y" className="text-xs px-3 py-1.5">WT901 Y</TabsTrigger>
                <TabsTrigger value="wt901-z" className="text-xs px-3 py-1.5">WT901 Z</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="temperature" className="p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Temperature</h3>
                <p className="text-xs text-gray-500 mb-3">Temperature measurements in Celsius</p>
                <div className="h-[400px]">
                  <TemperatureChart data={sensorData} isLoading={loading} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stroke" className="p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">LVDT</h3>
                <p className="text-xs text-gray-500 mb-3">LVDT displacement measurements in millimeters</p>
                <div className="h-[400px]">
                  <StrainChart data={sensorData} isLoading={loading} />
                </div>
              </div>
            </TabsContent>

          <TabsContent value="adxl-x" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ADXL X-Axis Acceleration</CardTitle>
                <CardDescription>
                  ADXL accelerometer X-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="ax_adxl" title="ADXL X-Axis" color="#ef4444" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adxl-y" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ADXL Y-Axis Acceleration</CardTitle>
                <CardDescription>
                  ADXL accelerometer Y-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="ay_adxl" title="ADXL Y-Axis" color="#22c55e" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adxl-z" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ADXL Z-Axis Acceleration</CardTitle>
                <CardDescription>
                  ADXL accelerometer Z-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="az_adxl" title="ADXL Z-Axis" color="#3b82f6" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wt901-x" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WT901 X-Axis Acceleration</CardTitle>
                <CardDescription>
                  WT901 accelerometer X-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="ax_wt901" title="WT901 X-Axis" color="#f59e0b" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wt901-y" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WT901 Y-Axis Acceleration</CardTitle>
                <CardDescription>
                  WT901 accelerometer Y-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="ay_wt901" title="WT901 Y-Axis" color="#8b5cf6" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wt901-z" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WT901 Z-Axis Acceleration</CardTitle>
                <CardDescription>
                  WT901 accelerometer Z-axis measurements
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px]">
                <AccelerometerChart data={sensorData} isLoading={loading} axis="az_wt901" title="WT901 Z-Axis" color="#06b6d4" />
              </CardContent>
            </Card>
          </TabsContent>
            <Card>
              <CardHeader>
                <CardTitle>accele_x</CardTitle>
                <CardDescription>
                  X-axis acceleration measurements
                </CardDescription>
              </CardHeader>
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