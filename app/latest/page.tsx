"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Activity, AlertTriangle, TrendingUp, Clock } from "lucide-react"
import { LatestDataChart } from "@/components/latest-data-chart"
import { CSVFileSelector } from "@/components/csv-file-selector"

export default function LatestDataPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date>(new Date())

  const handleGlobalRefresh = async () => {
    setIsRefreshing(true)
    // Trigger refresh in all chart components
    window.dispatchEvent(new CustomEvent('refreshLatestData'))
    
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false)
      setLastGlobalUpdate(new Date())
    }, 2000)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Latest Sensor Data</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of the most recent 1 minute of sensor data
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last 1 minute
          </Badge>
          <Button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>
      </div>

      {/* CSV File Selector */}
      <CSVFileSelector onDataUpdate={() => handleGlobalRefresh()} />

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Source</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CSV Data</div>
            <p className="text-xs text-muted-foreground">
              Uploaded or Google Drive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Window</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1 Min</div>
            <p className="text-xs text-muted-foreground">
              Most recent data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Refresh</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30s</div>
            <p className="text-xs text-muted-foreground">
              Automatic updates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {lastGlobalUpdate.toLocaleTimeString()}
            </div>
            <p className="text-xs text-muted-foreground">
              System time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sensor Charts Grid - Your CSV Columns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <LatestDataChart
          title="X-Axis Acceleration"
          dataKey="x"
          unit="g"
          color="#3b82f6"
          thresholds={{
            warning: 30,
            critical: 35
          }}
        />
        
        <LatestDataChart
          title="Y-Axis Acceleration"
          dataKey="y"
          unit="g"
          color="#10b981"
          thresholds={{
            warning: 0.5,
            critical: 0.8
          }}
        />
        
        <LatestDataChart
          title="Z-Axis Acceleration"
          dataKey="z"
          unit="g"
          color="#8b5cf6"
          thresholds={{
            warning: -0.7,
            critical: -0.9
          }}
        />
        
        <LatestDataChart
          title="Stroke"
          dataKey="stroke_mm"
          unit="mm"
          color="#f59e0b"
          thresholds={{
            warning: 0.05,
            critical: 0.1
          }}
        />
        
        <LatestDataChart
          title="Temperature"
          dataKey="temperature_c"
          unit="°C"
          color="#ef4444"
          thresholds={{
            warning: 30,
            critical: 35
          }}
        />
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">To connect to your Google Drive folder:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-2">
              <li>Set up Google Drive API credentials</li>
              <li>Update the CSV handler to read from your specific folder</li>
              <li>Configure the CSV parsing based on your data format</li>
              <li>Adjust the refresh intervals as needed</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold">Current Implementation:</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Now displaying your direct CSV columns: <strong>X, Y, Z, Stroke_mm, Temperature_C</strong>.
              The system reads from your CSV structure: Device, Timestamp, X, Y, Z, Stroke_mm, Temperature_C.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}