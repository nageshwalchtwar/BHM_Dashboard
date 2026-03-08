
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
  User,
  Users,
  Settings,
  UserCog,
  Moon,
  Sun,
  Mail
} from "lucide-react"
import { LatestDataChart } from "@/components/latest-data-chart"
import { TemperatureChart } from "@/components/temperature-chart"
import { StrainChart } from "@/components/strain-chart"
import { AccelerometerChart } from "@/components/accelerometer-chart"
import { PlotlyTimeSeriesChart } from "@/components/plotly-timeseries-chart"
import { DeviceSelector } from "@/components/device-selector"
import { ChartErrorBoundary } from "@/components/chart-error-boundary"


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
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalDataPoints: 0,
    latestTimestamp: '',
    dataSource: '',
    healthStatus: 'healthy',
    lastUpdate: ''
  })
  // Store RMS values for display
  const [rms, setRms] = useState<{
    accel_x_rms: number,
    accel_y_rms: number,
    accel_z_rms: number,
    wt901_x_rms: number,
    wt901_y_rms: number,
    wt901_z_rms: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')
  const [debugInfo, setDebugInfo] = useState<any>(null)

  // Device selector state
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined)
  const [timeRange, setTimeRange] = useState<string>('1') // minutes: 1, 60, 1440, 10080
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<string>('off')
  const [isRMSData, setIsRMSData] = useState(false)

  // UI state
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState('adxl-x')

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const result = await response.json()

        if (result.success) {
          setIsAuthenticated(true)
          setCurrentUser(result.user)
        } else {
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setMounted(true)
      }
    }

    checkAuth()
  }, [router])

  // DISABLED AUTO-REFRESH to save Railway costs - MANUAL REFRESH ONLY
  // useEffect(() => {
  //   fetchData()
  //   
  // Old auto-refresh (disabled)
  // useEffect(() => {
  //   if (autoRefresh) {
  //     const interval = setInterval(fetchData, 300000)
  //     return () => clearInterval(interval)
  //   }
  // }, [autoRefresh, timeRange, selectedDevice])

  // Fetch data when timeRange changes
  useEffect(() => {
    if (mounted) {
      fetchData()
    }
  }, [timeRange, mounted, selectedDevice])

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval === 'off' || !mounted) return
    const ms = parseInt(autoRefreshInterval) * 1000
    const interval = setInterval(fetchData, ms)
    return () => clearInterval(interval)
  }, [autoRefreshInterval, mounted, timeRange])

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
        setRms(result.rms || null)
        setIsRMSData(result.isRMSData || false)
        setError(null)
        setConnectionStatus('connected')
      } else {
        throw new Error(result.error || result.message || 'Failed to fetch data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setConnectionStatus('disconnected')
      setStats(prev => ({ ...prev, healthStatus: 'error' }))
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
    const ax = typeof latest.accel_x === 'number' ? latest.accel_x : 0
    const ay = typeof latest.accel_y === 'number' ? latest.accel_y : 0
    const az = typeof latest.accel_z === 'number' ? latest.accel_z : 0
    const acceleration = Math.sqrt(ax * ax + ay * ay + az * az)
    return {
      vibration: isNaN(acceleration) ? 'N/A' : acceleration.toFixed(2),
      temperature: typeof latest.temperature_c === 'number' && !isNaN(latest.temperature_c) ? latest.temperature_c.toFixed(1) : 'N/A',
      strain: typeof latest.stroke_mm === 'number' && !isNaN(latest.stroke_mm) ? latest.stroke_mm.toFixed(2) : 'N/A',
      acceleration: isNaN(acceleration) ? 'N/A' : acceleration.toFixed(3)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      // Ignore logout API errors
    }

    // Always redirect to login
    router.push('/login')
  }

  const handleTimeRangeChange = (newTimeRange: string) => {
    setTimeRange(newTimeRange)
    setSensorData([])
    setError(null)
  }

  const handleDeviceChange = (deviceId: string | undefined) => {
    setSelectedDevice(deviceId)
    setError(null) // Clear any previous errors
    fetchData() // Immediately fetch data for new device
  }

  const handleAdminClick = () => {
    router.push('/admin')
  }

  const handleUserManagement = () => {
    router.push('/users')
  }

  const handleAccountManagement = () => {
    router.push('/account')
  }

  const handleEmailReports = () => {
    router.push('/email-reports')
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('bhm_dark_mode', (!isDarkMode).toString())
  }

  // Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('bhm_dark_mode') === 'true'
    setIsDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [])

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
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-3 text-sm">
              {/* Connection Status */}
              <div className="flex items-center space-x-1">
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

              {/* Time Range Buttons */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {[
                  { value: '1', label: '1 Min' },
                  { value: '60', label: '1 Hour' },
                  { value: '1440', label: '1 Day' },
                  { value: '10080', label: '1 Week' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleTimeRangeChange(value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      timeRange === value
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Auto Refresh */}
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">Auto:</span>
                <Select value={autoRefreshInterval} onValueChange={setAutoRefreshInterval}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">1m</SelectItem>
                    <SelectItem value="300">5m</SelectItem>
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

              {/* Admin-only buttons */}
              {currentUser?.role === 'admin' && (
                <>
                  <Button
                    onClick={handleUserManagement}
                    size="sm"
                    variant="ghost"
                    className="h-8 flex items-center space-x-1"
                  >
                    <Users className="h-3 w-3" />
                    <span className="text-xs">Users</span>
                  </Button>

                  <Button
                    onClick={handleAdminClick}
                    size="sm"
                    variant="ghost"
                    className="h-8 flex items-center space-x-1"
                  >
                    <Settings className="h-3 w-3" />
                    <span className="text-xs">Devices</span>
                  </Button>

                  <Button
                    onClick={handleEmailReports}
                    size="sm"
                    variant="ghost"
                    className="h-8 flex items-center space-x-1"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="text-xs">Reports</span>
                  </Button>
                </>
              )}

              {/* Account Management */}
              <Button
                onClick={handleAccountManagement}
                size="sm"
                variant="ghost"
                className="h-8 flex items-center space-x-1"
              >
                <UserCog className="h-3 w-3" />
                <span className="text-xs">Account</span>
              </Button>

              {/* Dark Mode Toggle */}
              <Button
                onClick={toggleDarkMode}
                size="sm"
                variant="ghost"
                className="h-8"
              >
                {isDarkMode ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
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

        {/* Compact Stats Grid */}
        {latestValues && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Data Points */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Data Points</p>
                  <p className="text-lg font-bold text-gray-900">{stats?.totalDataPoints || 0}</p>
                  <p className="text-xs text-gray-400">Last {parseInt(timeRange) >= 10080 ? '1 week' : parseInt(timeRange) >= 1440 ? '1 day' : parseInt(timeRange) >= 60 ? '1 hour' : `${timeRange} min`}</p>
                </div>
                <Database className="h-5 w-5 text-blue-500" />
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <p className="text-lg font-bold text-green-600">
                    {stats?.healthStatus === 'healthy' ? 'Healthy' :
                      stats?.healthStatus === 'warning' ? 'Warning' : 'Error'}
                  </p>
                  <p className="text-xs text-gray-400">{mounted && stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
                {stats?.healthStatus === 'healthy' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : stats?.healthStatus === 'warning' ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>

            {/* Latest Reading */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Latest</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.latestTimestamp !== 'No data' ?
                      (typeof stats?.latestTimestamp === 'string' && stats.latestTimestamp.includes(':') ?
                        stats.latestTimestamp :
                        'N/A') : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400">Timestamp</p>
                </div>
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
            </div>



            {/* Acceleration (Peak) */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Accel</p>
                  <p className="text-lg font-bold text-gray-900">{latestValues.acceleration}g</p>
                  <p className="text-xs text-gray-400">Peak</p>
                </div>
                <Zap className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            {/* RMS Acceleration (1s window) */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 col-span-2 md:col-span-2 flex gap-4 overflow-hidden">
              <div className="flex flex-col gap-1 w-1/2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">ADXL RMS (1s)</p>
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-red-700">X: {rms ? rms.accel_x_rms.toFixed(4) : 'N/A'} g</span>
                  <span className="font-bold text-green-700">Y: {rms ? rms.accel_y_rms.toFixed(4) : 'N/A'} g</span>
                  <span className="font-bold text-blue-700">Z: {rms ? rms.accel_z_rms.toFixed(4) : 'N/A'} g</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 w-1/2 border-l border-gray-100 pl-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">WT901 RMS (1s)</p>
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-amber-600">X: {rms ? rms.wt901_x_rms.toFixed(4) : 'N/A'} g</span>
                  <span className="font-bold text-purple-600">Y: {rms ? rms.wt901_y_rms.toFixed(4) : 'N/A'} g</span>
                  <span className="font-bold text-cyan-600">Z: {rms ? rms.wt901_z_rms.toFixed(4) : 'N/A'} g</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section - Interactive Plotly */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <Tabs defaultValue="adxl-x" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-2">
              <TabsList className="flex flex-wrap gap-1 bg-gray-50 p-1">
                <TabsTrigger value="temperature" className="text-xs px-3 py-1.5">Temp</TabsTrigger>
                <TabsTrigger value="stroke" className="text-xs px-3 py-1.5">LVDT</TabsTrigger>
                <TabsTrigger value="adxl-x" className="text-xs px-3 py-1.5">ADXL X</TabsTrigger>
                <TabsTrigger value="adxl-y" className="text-xs px-3 py-1.5">ADXL Y</TabsTrigger>
                <TabsTrigger value="adxl-z" className="text-xs px-3 py-1.5">ADXL Z</TabsTrigger>
                <TabsTrigger value="wt901-x" className="text-xs px-3 py-1.5">WT901 X</TabsTrigger>
                <TabsTrigger value="wt901-y" className="text-xs px-3 py-1.5">WT901 Y</TabsTrigger>
                <TabsTrigger value="wt901-z" className="text-xs px-3 py-1.5">WT901 Z</TabsTrigger>
              </TabsList>
              {isRMSData && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                  RMS (1-sec window)
                </span>
              )}
            </div>

            <TabsContent value="temperature" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="Temperature chart failed to render">
                  {activeTab === 'temperature' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="temperature_c"
                      title="Temperature"
                      yAxisLabel="Temperature (°C)"
                      color="#ea580c"
                      unit="°C"
                      referenceLines={[
                        { y: 35, color: "#ef4444", label: "Critical (35°C)" },
                        { y: 30, color: "#f59e0b", label: "Warning (30°C)" },
                      ]}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="stroke" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="LVDT chart failed to render">
                  {activeTab === 'stroke' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="stroke_mm"
                      title="LVDT Displacement"
                      yAxisLabel="Stroke (mm)"
                      color="#7c3aed"
                      unit="mm"
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="adxl-x" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="ADXL X chart failed to render">
                  {activeTab === 'adxl-x' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="ax_adxl"
                      title="ADXL X-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#ef4444"
                      unit="g"
                      rms={rms ? rms.accel_x_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="adxl-y" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="ADXL Y chart failed to render">
                  {activeTab === 'adxl-y' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="ay_adxl"
                      title="ADXL Y-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#22c55e"
                      unit="g"
                      rms={rms ? rms.accel_y_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="adxl-z" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="ADXL Z chart failed to render">
                  {activeTab === 'adxl-z' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="az_adxl"
                      title="ADXL Z-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#3b82f6"
                      unit="g"
                      rms={rms ? rms.accel_z_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="wt901-x" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="WT901 X chart failed to render">
                  {activeTab === 'wt901-x' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="ax_wt901"
                      title="WT901 X-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#f59e0b"
                      unit="g"
                      rms={rms ? rms.wt901_x_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="wt901-y" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="WT901 Y chart failed to render">
                  {activeTab === 'wt901-y' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="ay_wt901"
                      title="WT901 Y-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#8b5cf6"
                      unit="g"
                      rms={rms ? rms.wt901_y_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="wt901-z" className="p-4">
              <div className="h-[500px]">
                <ChartErrorBoundary fallbackMessage="WT901 Z chart failed to render">
                  {activeTab === 'wt901-z' && (
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="az_wt901"
                      title="WT901 Z-Axis Acceleration"
                      yAxisLabel="Acceleration (g)"
                      color="#06b6d4"
                      unit="g"
                      rms={rms ? rms.wt901_z_rms : undefined}
                    />
                  )}
                </ChartErrorBoundary>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Info */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800">Bridge Health Monitoring System</h3>
              <p className="text-sm text-blue-600">
                Real-time monitoring with automatic data synchronization from Google Drive
              </p>
            </div>
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
              Live Data
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}