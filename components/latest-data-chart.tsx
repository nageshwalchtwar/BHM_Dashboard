"use client"

import { useState, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Activity } from "lucide-react"
import { CSVSensorData } from "@/lib/csv-handler"

interface LatestDataChartProps {
  title: string
  dataKey: 'x' | 'y' | 'z' | 'stroke_mm' | 'temperature_c' | 'vibration' | 'acceleration' | 'strain' | 'temperature'
  unit: string
  color: string
  thresholds?: {
    warning: number
    critical: number
  }
}

export function LatestDataChart({ title, dataKey, unit, color, thresholds }: LatestDataChartProps) {
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<CSVSensorData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLatestData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/csv-data-real?minutes=10')
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
        setLastUpdate(new Date())
        console.log(`📈 Chart updated with ${result.data.length} real data points from ${result.metadata?.filename || 'unknown'}`)
      } else {
        setError(result.error || 'No real CSV data available from Google Drive')
        console.log('❌ Real data fetch failed:', result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      console.error('❌ Chart data fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchLatestData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLatestData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    // Show only MM:SS for better readability
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload // Get the full data point
      const actualValue = dataPoint[dataKey] || payload[0].value // Use the actual field value
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dataPoint.rawTimestamp || new Date(label).toLocaleTimeString('en-US', { hour12: false })}
          </p>
          <p className="text-sm font-semibold" style={{ color }}>
            {title}: {typeof actualValue === 'number' ? actualValue.toFixed(4) : (actualValue || 'N/A')} {unit}
          </p>
        </div>
      )
    }
    return null
  }

  const getStatus = (currentValue: number) => {
    if (!thresholds) return 'normal'
    if (currentValue >= thresholds.critical) return 'critical'
    if (currentValue >= thresholds.warning) return 'warning'
    return 'normal'
  }

  const latestValue = data.length > 0 ? data[data.length - 1][dataKey] : 0
  const status = getStatus(latestValue ?? 0)

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLatestData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">Error: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge 
            variant={status === 'critical' ? 'destructive' : status === 'warning' ? 'secondary' : 'outline'}
          >
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color }}>
              {typeof latestValue === 'number' ? latestValue.toFixed(2) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {unit} • {data.length} points
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLatestData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-2">
          Last 10 minutes • Updated: {mounted && lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
        </div>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse" />
              <span className="text-slate-600">Loading latest data...</span>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center bg-slate-50 rounded-lg">
            <span className="text-slate-600">No recent data available</span>
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                  stroke="#64748b" 
                  fontSize={10}
                  interval="preserveStartEnd"
                  height={60}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={['dataMin - 5%', 'dataMax + 5%']}
                  tickFormatter={(value) => typeof value === 'number' ? value.toFixed(4) : value}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, stroke: color, strokeWidth: 2 }}
                />
                {thresholds && (
                  <>
                    <ReferenceLine 
                      y={thresholds.warning} 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5"
                      label={{ value: "Warning", position: "insideTopRight" }}
                    />
                    <ReferenceLine 
                      y={thresholds.critical} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5"
                      label={{ value: "Critical", position: "insideTopRight" }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}