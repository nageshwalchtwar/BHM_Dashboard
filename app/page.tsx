"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Activity, FileText, Clock, CheckCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SensorData {
  device: string
  timestamp: string
  x: number
  y: number
  z: number
  stroke_mm: number
  temperature_c: number
}

interface ChartProps {
  title: string
  dataKey: string
  color: string
  unit: string
  data: SensorData[]
}

function SensorChart({ title, dataKey, color, unit, data }: ChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>Latest sensor readings</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleTimeString()
              }}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip 
              labelFormatter={(value) => `Time: ${new Date(value).toLocaleString()}`}
              formatter={(value) => [`${value} ${unit}`, title]}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string>("")

  const fetchLatestCSV = async () => {
    setIsLoading(true)
    setError("")
    
    try {
      const response = await fetch('/api/simple-csv')
      const result = await response.json()
      
      if (result.success && result.data) {
        // Parse CSV data
        const lines = result.data.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        
        const parsedData: SensorData[] = lines.slice(1).map(line => {
          const values = line.split(',')
          return {
            device: values[0] || '',
            timestamp: values[1] || '',
            x: parseFloat(values[2]) || 0,
            y: parseFloat(values[3]) || 0,
            z: parseFloat(values[4]) || 0,
            stroke_mm: parseFloat(values[5]) || 0,
            temperature_c: parseFloat(values[6]) || 0
          }
        }).filter(row => row.timestamp) // Filter out invalid rows
        
        // Get last 100 data points for better performance
        const latestData = parsedData.slice(-100)
        setSensorData(latestData)
        setLastUpdate(new Date())
      } else {
        setError(result.error || 'Failed to fetch CSV data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-fetch on component mount
  useEffect(() => {
    fetchLatestCSV()
  }, [])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchLatestCSV, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bridge Health Monitor</h1>
          <p className="text-muted-foreground">
            Real-time monitoring from latest CSV in Google Drive folder
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Auto-refresh: 2min
          </Badge>
          <Button
            onClick={fetchLatestCSV}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Source</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Google Drive</div>
            <p className="text-xs text-muted-foreground">Latest CSV auto-loaded</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sensorData.length}</div>
            <p className="text-xs text-muted-foreground">Sensor readings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className={`h-4 w-4 ${error ? 'text-red-500' : 'text-green-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{error ? 'Error' : 'Active'}</div>
            <p className="text-xs text-muted-foreground">
              {error ? 'Check connection' : 'System operational'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastUpdate.toLocaleTimeString()}</div>
            <p className="text-xs text-muted-foreground">Latest data fetch</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensor Charts */}
      {sensorData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <SensorChart
            title="X-Axis Acceleration"
            dataKey="x"
            color="#8884d8"
            unit="g"
            data={sensorData}
          />
          <SensorChart
            title="Y-Axis Acceleration"
            dataKey="y"
            color="#82ca9d"
            unit="g"
            data={sensorData}
          />
          <SensorChart
            title="Z-Axis Acceleration"
            dataKey="z"
            color="#ffc658"
            unit="g"
            data={sensorData}
          />
          <SensorChart
            title="Stroke Measurement"
            dataKey="stroke_mm"
            color="#ff7300"
            unit="mm"
            data={sensorData}
          />
          <SensorChart
            title="Temperature"
            dataKey="temperature_c"
            color="#8dd1e1"
            unit="°C"
            data={sensorData}
          />
        </div>
      )}

      {/* No Data State */}
      {sensorData.length === 0 && !isLoading && !error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-yellow-800 text-center">
              <strong>No Data Available</strong>
              <p className="mt-2">Click refresh to load the latest CSV from your Google Drive folder.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


