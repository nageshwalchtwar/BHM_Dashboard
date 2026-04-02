
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
  const [viewMode, setViewMode] = useState<string>('date') // 'date' | 'week'
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date(); return d.toISOString().split('T')[0]
  })
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<string>('off')
  const [isRMSData, setIsRMSData] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState('adxl-z')

  // Effective minutes for chart tick formatting
  const effectiveMinutes = ({ '1min': '1', '5min': '5' } as Record<string, string>)[viewMode] || '1440'
  const isLiveMode = viewMode === '1min' || viewMode === '5min'

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

  // Fetch data when viewMode or selectedDate changes
  useEffect(() => {
    if (mounted) {
      fetchData()
    }
  }, [viewMode, selectedDate, mounted, selectedDevice])

  // Load available dates for currently selected device
  useEffect(() => {
    if (!mounted) return
    fetchAvailableDates()
  }, [mounted, selectedDevice])

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval === 'off' || !mounted) return
    const ms = parseInt(autoRefreshInterval) * 1000
    const interval = setInterval(fetchData, ms)
    return () => clearInterval(interval)
  }, [autoRefreshInterval, mounted, viewMode])

  const fetchData = async () => {
    if (viewMode === 'date' && !selectedDate) {
      setError('No data dates available for the selected device')
      setLoading(false)
      return
    }

    setConnectionStatus('connecting')
    try {
      // Use merged-day endpoint for 1-day view, regular endpoint for live modes
      let apiUrl = viewMode === 'date' 
        ? `/api/csv-data-merged-day?date=${selectedDate}`
        : `/api/csv-data-real?mode=${viewMode}`
      
      if (selectedDevice) {
        apiUrl += `&device=${selectedDevice}`
      }


      const response = await fetch(apiUrl)
      
      // Guard against non-JSON responses (e.g. rate limit text)
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(text.slice(0, 100) || `Server returned ${response.status}`)
      }
      
      const result = await response.json()

      if (result.success && result.data) {
        setSensorData(result.data)
        setStats({
          totalDataPoints: result.metadata.totalPoints,
          latestTimestamp: result.data.length > 0 && result.data[0].rawTimestamp ?
            result.data[0].rawTimestamp :
            (result.data.length > 0 ? new Date(result.data[0].timestamp).toISOString().slice(11, 23) : 'No data'),
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

  const fetchAvailableDates = async () => {
    setDatesLoading(true)
    try {
      let url = '/api/csv-available-dates'
      if (selectedDevice) {
        url += `?device=${selectedDevice}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success && Array.isArray(result.dates)) {
        const dates = result.dates as string[]
        setAvailableDates(dates)

        if (dates.length === 0) {
          setSelectedDate('')
        } else if (!dates.includes(selectedDate)) {
          setSelectedDate(dates[0])
        }
      } else {
        setAvailableDates([])
        setSelectedDate('')
      }
    } catch {
      setAvailableDates([])
      setSelectedDate('')
    } finally {
      setDatesLoading(false)
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

  const handleViewModeChange = (mode: string) => {
    setViewMode(mode)
    setSensorData([])
    setError(null)
    // Auto-enable refresh for live modes, disable for historical
    if (mode === '1min') {
      setAutoRefreshInterval('10')
    } else if (mode === '5min') {
      setAutoRefreshInterval('30')
    } else {
      setAutoRefreshInterval('off')
    }
  }

  const handleDeviceChange = (deviceId: string | undefined) => {
    setSelectedDevice(deviceId)
    setError(null)
    fetchData()
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

  // Don't render anything until authentication is checked
  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          {/* BHM Letters */}
          <div className="bhm-glow">
            <span className="bhm-letter text-7xl font-black tracking-wider text-white" style={{fontFamily: 'system-ui'}}>B</span>
            <span className="bhm-letter text-7xl font-black tracking-wider text-blue-400" style={{fontFamily: 'system-ui'}}>H</span>
            <span className="bhm-letter text-7xl font-black tracking-wider text-white" style={{fontFamily: 'system-ui'}}>M</span>
          </div>
          {/* Subtitle */}
          <p className="bhm-subtitle text-sm tracking-[0.3em] uppercase text-blue-300/70 font-medium">
            Bridge Health Monitor
          </p>
          {/* Wave bars */}
          <div className="flex items-end gap-1 h-8 mt-2">
            {[0, 0.15, 0.3, 0.45, 0.6, 0.45, 0.3, 0.15, 0].map((delay, i) => (
              <div
                key={i}
                className="w-1 bg-blue-400/60 rounded-full bhm-wave-bar"
                style={{ height: '100%', animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const latestValues = getLatestValues()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* BHM Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900/95 via-blue-950/95 to-slate-900/95 backdrop-blur-sm flex items-center justify-center transition-opacity">
          <div className="flex flex-col items-center gap-6">
            {/* BHM Letters */}
            <div className="bhm-glow">
              <span className="bhm-letter text-8xl font-black tracking-wider text-white" style={{fontFamily: 'system-ui'}}>B</span>
              <span className="bhm-letter text-8xl font-black tracking-wider text-blue-400" style={{fontFamily: 'system-ui'}}>H</span>
              <span className="bhm-letter text-8xl font-black tracking-wider text-white" style={{fontFamily: 'system-ui'}}>M</span>
            </div>
            {/* Subtitle */}
            <p className="bhm-subtitle text-sm tracking-[0.3em] uppercase text-blue-300/70 font-medium">
              Bridge Health Monitor
            </p>
            {/* Wave bars */}
            <div className="flex items-end gap-1.5 h-10 mt-4">
              {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.1, 0].map((delay, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-blue-500 to-blue-300 rounded-full bhm-wave-bar"
                  style={{ height: '100%', animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            {/* Progress bar */}
            <div className="w-48 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full bhm-progress-bar" />
            </div>
            <p className="text-xs text-blue-400/50 mt-1">Syncing sensor data...</p>
          </div>
        </div>
      )}
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

              {/* View Mode Buttons */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {[
                  { value: '1min', label: '1 Min' },
                  { value: '5min', label: '5 Min' },
                  { value: 'date', label: '1 Day' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleViewModeChange(value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      viewMode === value
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Date picker for 1 Day mode */}
              {viewMode === 'date' && (
                <Select value={selectedDate || undefined} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder={datesLoading ? 'Loading dates...' : 'Select date'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.length === 0 ? (
                      <SelectItem value="no-dates" disabled>
                        {datesLoading ? 'Loading...' : 'No dates found'}
                      </SelectItem>
                    ) : (
                      availableDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          {date}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

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
                  <p className="text-xs text-gray-400">
                    {viewMode === '1min' ? 'Last 1 min' : viewMode === '5min' ? 'Last 5 min' : selectedDate || 'Latest'}
                  </p>
                </div>
                <Database className="h-5 w-5 text-blue-500" />
              </div>
            </div>

            {/* Device Status - Online/Offline */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Device Status</p>
                  {(() => {
                    const lastUpdateTime = stats?.lastUpdate ? new Date(stats.lastUpdate).getTime() : 0
                    const now = Date.now()
                    const hoursAgo = (now - lastUpdateTime) / (1000 * 60 * 60)
                    const isOnline = hoursAgo < 6
                    return (
                      <>
                        <p className={`text-lg font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </p>
                        <p className="text-xs text-gray-400">{mounted && stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}</p>
                      </>
                    )
                  })()}
                </div>
                {(() => {
                  const lastUpdateTime = stats?.lastUpdate ? new Date(stats.lastUpdate).getTime() : 0
                  const now = Date.now()
                  const hoursAgo = (now - lastUpdateTime) / (1000 * 60 * 60)
                  const isOnline = hoursAgo < 6
                  return isOnline ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
                })()}
              </div>
            </div>

            {/* Latest Data Received */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Latest Data Received</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.latestTimestamp !== 'No data' ?
                      (typeof stats?.latestTimestamp === 'string' && stats.latestTimestamp.includes(':') ?
                        stats.latestTimestamp.split('.')[0] :
                        'N/A') : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400">Timestamp</p>
                </div>
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            {/* Bridge Health Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 col-span-2 md:col-span-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Bridge Health</p>
                
                {/* Vibration Status */}
                <div className="text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Vibration:</span>
                    {(() => {
                      const vibValue = rms ? Math.abs(rms.accel_z_rms) : 0
                      let statusColor = 'text-green-600'
                      let statusText = 'Good'
                      if (vibValue > 0.1) { statusColor = 'text-red-600'; statusText = 'Critical' }
                      else if (vibValue > 0.05) { statusColor = 'text-yellow-600'; statusText = 'Warning' }
                      return <span className={`font-bold ${statusColor}`}>{vibValue.toFixed(4)}g {statusText}</span>
                    })()}
                  </div>
                  <div className="text-gray-500">Limits: ⚠️ 0.05g | 🔴 0.1g</div>
                </div>

                {/* Deflection Status */}
                <div className="text-xs space-y-1 border-t pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Deflection:</span>
                    {(() => {
                      const lvdtValue = sensorData.length > 0 ? sensorData[sensorData.length-1].stroke_mm || 0 : 0
                      let statusColor = 'text-green-600'
                      let statusText = 'Good'
                      if (lvdtValue > 100) { statusColor = 'text-red-600'; statusText = 'Critical L/600' }
                      else if (lvdtValue > 75) { statusColor = 'text-yellow-600'; statusText = 'Warning L/800' }
                      return <span className={`font-bold ${statusColor}`}>{lvdtValue.toFixed(1)}mm {statusText}</span>
                    })()}
                  </div>
                  <div className="text-gray-500">Limits: ⚠️ 75mm (L/800) | 🔴 100mm (L/600)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section - Interactive Plotly */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <Tabs defaultValue="adxl-z" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-2">
              <TabsList className="flex flex-wrap gap-1 bg-gray-50 p-1">
                <TabsTrigger value="temperature" className="text-xs px-3 py-1.5">Temp</TabsTrigger>
                <TabsTrigger value="stroke" className="text-xs px-3 py-1.5">LVDT</TabsTrigger>
                <TabsTrigger value="adxl-z" className="text-xs px-3 py-1.5">ADXL Z</TabsTrigger>
              </TabsList>
              <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                {viewMode === 'date' ? '10s average' : '1 sample/sec'}
              </span>
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
                      timeRange={effectiveMinutes}
                      basicLineplot={true}
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
                      timeRange={effectiveMinutes}
                      basicLineplot={true}
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
                      dataKey={viewMode === 'date' ? "accel_z" : "az_adxl"}
                      title={viewMode === 'date' ? "ADXL Z Acceleration (Pre-computed RMS)" : "ADXL RMS Vibration vs Time (1 Second RMS)"}
                      yAxisLabel="RMS Acceleration (g)"
                      color="#10b981"
                      unit="g"
                      rms={viewMode !== 'date' && rms ? rms.accel_z_rms : undefined}
                      timeRange={effectiveMinutes}
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