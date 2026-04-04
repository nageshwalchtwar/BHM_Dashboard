
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
  const [viewMode, setViewMode] = useState<string>('5min') // Default to 5 minutes
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date(); return d.toISOString().split('T')[0]
  })
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<string>('off')
  const [isRMSData, setIsRMSData] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState('adxl-z')
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  const [fullscreenChart, setFullscreenChart] = useState<'lvdt' | 'accelerometer' | 'temperature' | 'fft'>('lvdt')
  const [chartView, setChartView] = useState<'default' | 'temperature'>('default')
  const [autoScale] = useState(true) // Auto-scale is always enabled by default

  // Calculate bridge health status dynamically based on actual data
  const bridgeHealthStatus = (() => {
    if (!sensorData || sensorData.length === 0) return 'healthy'
    
    const latestData = sensorData[sensorData.length - 1]
    const temp = latestData.temperature_c || 0
    const deflection = latestData.stroke_mm || 0
    // Only use RMS vibration data in live modes (1min, 5min), not in date view
    const vibration = (viewMode !== 'date' && rms?.accel_z_rms) ? rms.accel_z_rms : 0
    
    // Critical thresholds
    if (temp > 35 || deflection > 100 || vibration > 0.1) {
      return 'critical'
    }
    
    // Warning thresholds
    if (temp > 30 || deflection > 75 || vibration > 0.05) {
      return 'warning'
    }
    
    return 'healthy'
  })()

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

  // Generate FFT data for frequency domain visualization
  const generateFFTData = (data: SensorData[]) => {
    if (!data || data.length < 2) {
      return []
    }
    
    // Use all available 10-minute data (first 60 points is ~10 min at 10s intervals)
    const tenMinDataPoints = Math.min(60, data.length)
    const recentData = data.slice(0, tenMinDataPoints)
    
    // Extract acceleration envelope (RMS of 3-axis)
    const signal: number[] = recentData.map(d => {
      const ax = d.accel_x || 0
      const ay = d.accel_y || 0
      const az = d.accel_z || 0
      return Math.sqrt(ax*ax + ay*ay + az*az)
    })

    // Compute simple DFT (Discrete Fourier Transform) for frequency analysis
    // Sampling interval = 10 seconds, so sampling rate = 0.1 Hz
    const samplingRate = 0.1 // samples per second (1 sample per 10 seconds)
    const N = signal.length
    const fft: number[] = []
    
    // Calculate magnitude for frequency bins (0 to Nyquist)
    // Nyquist frequency = samplingRate / 2 = 0.05 Hz
    // But we'll extend to show meaningful frequencies
    const numBins = 50
    
    for (let k = 0; k < numBins; k++) {
      let real = 0
      let imag = 0
      
      // DFT formula: X[k] = sum(x[n] * exp(-j*2*pi*k*n/N))
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N
        real += signal[n] * Math.cos(angle)
        imag += signal[n] * Math.sin(angle)
      }
      
      // Magnitude spectrum
      const magnitude = Math.sqrt(real * real + imag * imag) / N
      fft.push(magnitude)
    }

    // Convert to SensorData format for plotting
    const fftData: SensorData[] = fft.map((magnitude, index) => {
      // Create timestamps that span over 10 minutes (600 seconds) for x-axis
      // This gives a proper time range for plotting
      const secondsOffset = (index / numBins) * 600 // 0 to 600 seconds
      const timestamp = new Date(new Date().getTime() - 600000 + secondsOffset * 1000)
      
      return {
        timestamp: timestamp.toISOString(),
        accel_x: magnitude,
        accel_y: 0,
        accel_z: 0,
        stroke_mm: 0,
        temperature_c: 0
      }
    })

    return fftData
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
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-blue-50">
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
      <div className="w-full h-screen p-4 space-y-3 overflow-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200">
          <div className="flex items-center space-x-6">
            <div>
              <h1 className="text-5xl font-bold text-gray-900">
                Bridge Health Monitor
              </h1>
              <p className="text-lg text-gray-600">
                Real-time structural monitoring system
              </p>
            </div>
            
            {/* Device Selector - Top Integrated */}
            <div className="border-l border-gray-300 pl-8 py-2">
              <div className="text-base font-semibold text-gray-700 mb-2">Device:</div>
              <DeviceSelector
                selectedDevice={selectedDevice}
                onDeviceChange={handleDeviceChange}
                className="text-base font-semibold"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 ml-auto">
            <Button
              onClick={runDebugTest}
              disabled={loading}
              size="sm"
              variant="ghost"
              className="h-10 w-10"
            >
              <AlertTriangle className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-10 flex items-center space-x-1 px-3"
            >
              <User className="h-5 w-5" />
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Row 2: Status Indicators, Controls, and Time Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          <div className="flex items-center space-x-3 flex-wrap gap-1">
            {/* Node Status Indicator */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-base font-semibold text-gray-900">Node: Connected</span>
            </div>

            {/* Bridge Health Alert */}
            {bridgeHealthStatus !== 'healthy' && (
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                bridgeHealthStatus === 'critical' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  bridgeHealthStatus === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-base font-semibold text-gray-900">
                  Bridge: {bridgeHealthStatus === 'critical' ? 'Critical' : 'Alert'}
                </span>
              </div>
            )}

            {/* Connection Status (Live Button) */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-6 w-6 text-green-500" />
              ) : connectionStatus === 'connecting' ? (
                <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
              ) : (
                <WifiOff className="h-6 w-6 text-red-500" />
              )}
              <span className="text-base font-semibold text-gray-700">
                {connectionStatus === 'connected' ? 'Live' :
                  connectionStatus === 'connecting' ? 'Syncing...' : 'Offline'}
              </span>
            </div>

            {/* View Mode Buttons (Time Selection) */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1.5 gap-1.5">
              {[
                { value: '1min', label: '1 Min' },
                { value: '5min', label: '5 Min' },
                { value: 'date', label: '1 Day' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleViewModeChange(value)}
                  className={`px-5 py-2.5 text-base font-bold rounded-md transition-colors ${
                    viewMode === value
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Temperature Button */}
            {chartView === 'default' ? (
              <Button
                onClick={() => setChartView('temperature')}
                className="text-base px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold transition-colors"
              >
                Temperature
              </Button>
            ) : (
              <Button
                onClick={() => setChartView('default')}
                className="text-base px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-bold transition-colors"
              >
                Back
              </Button>
            )}

            {/* Date picker for 1 Day mode */}
            {viewMode === 'date' && (
              <div className="w-56">
                <Select value={selectedDate || undefined} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-full h-11 text-base font-bold">
                    <SelectValue placeholder={datesLoading ? 'Loading...' : 'Select date'} />
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
              </div>
            )}

            {/* Auto Refresh */}
            <div className="flex items-center space-x-2 ml-auto">
              <span className="text-base font-bold text-gray-700">Auto:</span>
              <Select value={autoRefreshInterval} onValueChange={setAutoRefreshInterval}>
                <SelectTrigger className="w-28 h-11 text-base font-bold">
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

        {/* Charts Section - LVDT and ADXL Side by Side */}
        {isChartFullscreen ? (
          // Fullscreen mode - show single chart
          <div className="fixed inset-0 z-40 bg-white flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {fullscreenChart === 'lvdt' ? 'LVDT Displacement' : 
                 fullscreenChart === 'accelerometer' ? 'Accelerometer RMS Vibration' :
                 fullscreenChart === 'temperature' ? 'Temperature vs Time' :
                 'FFT - Acceleration Envelope Spectrum'} - Fullscreen
              </h2>
              <button
                onClick={() => setIsChartFullscreen(false)}
                className="text-gray-500 hover:text-gray-900 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <div className="w-full h-full">
                {fullscreenChart === 'lvdt' ? (
                  <ChartErrorBoundary fallbackMessage="LVDT chart failed to render">
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
                      scaleFromZero={autoScale}
                      referenceLines={[
                        { y: 100, color: "#ef4444", label: "Critical (100mm L/600)" },
                      ]}
                    />
                  </ChartErrorBoundary>
                ) : fullscreenChart === 'accelerometer' ? (
                  <ChartErrorBoundary fallbackMessage="Accelerometer chart failed to render">
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey={viewMode === 'date' ? "accel_z" : "az_adxl"}
                      title="Accelerometer RMS Vibration vs Time"
                      yAxisLabel="RMS Acceleration (g)"
                      color="#10b981"
                      unit="g"
                      rms={viewMode !== 'date' && rms ? rms.accel_z_rms : undefined}
                      timeRange={effectiveMinutes}
                      basicLineplot={true}
                      scaleFromZero={autoScale}
                      referenceLines={[
                        { y: 0.1, color: "#ef4444", label: "Critical (0.1g)" },
                      ]}
                    />
                  </ChartErrorBoundary>
                ) : fullscreenChart === 'temperature' ? (
                  <ChartErrorBoundary fallbackMessage="Temperature chart failed to render">
                    <PlotlyTimeSeriesChart
                      data={sensorData}
                      isLoading={loading}
                      dataKey="temperature_c"
                      title="Temperature vs Time"
                      yAxisLabel="Temperature (°C)"
                      color="#f59e0b"
                      unit="°C"
                      timeRange={effectiveMinutes}
                      basicLineplot={true}
                      scaleFromZero={autoScale}
                      referenceLines={[
                        { y: 35, color: "#ef4444", label: "Critical (35°C)" },
                      ]}
                    />
                  </ChartErrorBoundary>
                ) : (
                  <ChartErrorBoundary fallbackMessage="FFT chart failed to render">
                    {sensorData.length > 0 ? (
                      <PlotlyTimeSeriesChart
                        data={generateFFTData(sensorData)}
                        isLoading={loading}
                        dataKey="accel_x"
                        title="Frequency Domain Analysis"
                        yAxisLabel="Amplitude"
                        color="#ef4444"
                        unit="m/s²"
                        basicLineplot={true}
                        scaleFromZero={autoScale}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for FFT analysis
                      </div>
                    )}
                  </ChartErrorBoundary>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {chartView === 'temperature' ? (
                // Temperature Chart View
                <div className="w-full h-full flex flex-col">
                  <div className="text-base font-bold text-gray-900 px-4 py-3 border-b border-gray-200">
                    Temperature
                  </div>
                  <div className="flex-1 overflow-hidden p-4">
                    <ChartErrorBoundary fallbackMessage="Temperature chart failed to render">
                      <PlotlyTimeSeriesChart
                        data={sensorData}
                        isLoading={loading}
                        dataKey="temperature_c"
                        title="Temperature vs Time"
                        yAxisLabel="Temperature (°C)"
                        color="#f59e0b"
                        unit="°C"
                        timeRange={effectiveMinutes}
                        basicLineplot={true}
                        scaleFromZero={autoScale}
                        referenceLines={[
                          { y: 35, color: "#ef4444", label: "Critical (35°C)" },
                        ]}
                      />
                    </ChartErrorBoundary>
                  </div>
                </div>
              ) : (
                // Default Side-by-Side LVDT and Accelerometer View
                <div className="grid grid-cols-2 h-[500px] gap-3 p-4">
                  {/* LVDT Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden relative shadow-sm">
                    <div className="text-lg font-bold text-gray-900 px-4 py-4 border-b border-gray-200">
                      LVDT Displacement
                    </div>
                    <div className="flex-1 overflow-hidden p-4">
                      <ChartErrorBoundary fallbackMessage="LVDT chart failed to render">
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
                          scaleFromZero={autoScale}
                          referenceLines={[
                            { y: 100, color: "#ef4444", label: "Critical (100mm L/600)" },
                          ]}
                        />
                      </ChartErrorBoundary>
                    </div>
                    
                    {/* Fullscreen Button - LVDT */}
                    <button
                      onClick={() => {setIsChartFullscreen(true); setFullscreenChart('lvdt')}}
                      className="absolute top-12 right-2 bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-2 rounded transition-colors font-medium"
                    >
                      ⛶
                    </button>
                  </div>

                  {/* Accelerometer Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden relative shadow-sm">
                    <div className="text-lg font-bold text-gray-900 px-4 py-4 border-b border-gray-200">
                      Accelerometer RMS Vibration
                    </div>
                    <div className="flex-1 overflow-hidden p-4">
                      <ChartErrorBoundary fallbackMessage="ADXL Z chart failed to render">
                        <PlotlyTimeSeriesChart
                          data={sensorData}
                          isLoading={loading}
                          dataKey={viewMode === 'date' ? "accel_z" : "az_adxl"}
                          title="Accelerometer RMS Vibration vs Time"
                          yAxisLabel="RMS Acceleration (g)"
                          color="#10b981"
                          unit="g"
                          rms={viewMode !== 'date' && rms ? rms.accel_z_rms : undefined}
                          timeRange={effectiveMinutes}
                          basicLineplot={true}
                          scaleFromZero={autoScale}
                          referenceLines={[
                            { y: 0.1, color: "#ef4444", label: "Critical (0.1g)" },
                          ]}
                        />
                      </ChartErrorBoundary>
                    </div>

                    {/* Fullscreen Button - Accelerometer */}
                    <button
                      onClick={() => {setIsChartFullscreen(true); setFullscreenChart('accelerometer')}}
                      className="absolute top-12 right-2 bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-2 rounded transition-colors font-medium"
                    >
                      ⛶
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Bottom Row: Temperature Chart (Left) and FFT Chart (Right) */}
        <div className="grid grid-cols-2 h-[500px] gap-3 p-4">
          {/* Temperature Chart */}
          <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden relative shadow-sm">
            <div className="text-lg font-bold text-gray-900 px-4 py-4 border-b border-gray-200">
              Temperature vs Time
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <ChartErrorBoundary fallbackMessage="Temperature chart failed to render">
                <PlotlyTimeSeriesChart
                  data={sensorData}
                  isLoading={loading}
                  dataKey="temperature_c"
                  title="Temperature vs Time"
                  yAxisLabel="Temperature (°C)"
                  color="#f59e0b"
                  unit="°C"
                  timeRange={effectiveMinutes}
                  basicLineplot={true}
                  scaleFromZero={autoScale}
                  referenceLines={[
                    { y: 35, color: "#ef4444", label: "Critical (35°C)" },
                  ]}
                />
              </ChartErrorBoundary>
            </div>
            
            {/* Fullscreen Button - Temperature */}
            <button
              onClick={() => {setIsChartFullscreen(true); setFullscreenChart('temperature')}}
              className="absolute top-12 right-2 bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-2 rounded transition-colors font-medium"
            >
              ⛶
            </button>
          </div>

          {/* FFT Chart (10 Minute Frequency Analysis) */}
          <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden relative shadow-sm">
            <div className="text-lg font-bold text-gray-900 px-4 py-4 border-b border-gray-200">
              FFT - Acceleration Envelope Spectrum
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <ChartErrorBoundary fallbackMessage="FFT chart failed to render">
                {sensorData.length > 0 ? (
                  <PlotlyTimeSeriesChart
                    data={generateFFTData(sensorData)}
                    isLoading={loading}
                    dataKey="accel_x"
                    title="Frequency Domain Analysis"
                    yAxisLabel="Amplitude"
                    color="#ef4444"
                    unit="m/s²"
                    basicLineplot={true}
                    scaleFromZero={autoScale}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available for FFT analysis
                  </div>
                )}
              </ChartErrorBoundary>
            </div>
            
            {/* Fullscreen Button - FFT */}
            <button
              onClick={() => {setIsChartFullscreen(true); setFullscreenChart('fft')}}
              className="absolute top-12 right-2 bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-2 rounded transition-colors font-medium"
            >
              ⛶
            </button>
          </div>
        </div>


      </div>
    </div>
  )
}