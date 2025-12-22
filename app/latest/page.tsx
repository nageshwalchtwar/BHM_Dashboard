"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Activity, AlertTriangle, TrendingUp, Clock } from "lucide-react"
import { LatestDataChart } from "@/components/latest-data-chart"
import { CSVFileSelector } from "@/components/csv-file-selector"
import { useRouter } from "next/navigation"

export default function LatestDataPage() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date>(new Date())

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (!isLoggedIn) {
        router.replace("/login");
      }
    }
  }, [router]);

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

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    router.replace("/login");
  };

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
          <Button onClick={handleLogout} variant="outline">
            Logout
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
            <div className="text-2xl font-bold">{lastGlobalUpdate.toLocaleTimeString()}</div>
            <p className="text-xs text-muted-foreground">
              System time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sensor Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <LatestDataChart
          title="X-Axis Acceleration"
          dataKey="x"
          color="#8884d8"
          unit="g"
        />
        <LatestDataChart
          title="Y-Axis Acceleration"
          dataKey="y"
          color="#82ca9d"
          unit="g"
        />
        <LatestDataChart
          title="Z-Axis Acceleration"
          dataKey="z"
          color="#ffc658"
          unit="g"
        />
        <LatestDataChart
          title="Stroke"
          dataKey="stroke_mm"
          color="#ff7300"
          unit="mm"
        />
        <LatestDataChart
          title="Temperature"
          dataKey="temperature_c"
          color="#8dd1e1"
          unit="°C"
        />
      </div>

      {/* Setup Instructions */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-yellow-700">
          <p className="mb-3">To connect to your Google Drive folder:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Select your CSV file from the dropdown above</li>
            <li>Click "Open in Drive" to access your Google Drive folder</li>
            <li>Copy the CSV content and paste it in the text area</li>
            <li>Click "Plot Data" to see your real sensor data in the charts</li>
          </ol>
          <div className="mt-4 p-3 bg-white rounded border text-xs">
            <strong>Current Implementation:</strong> Now displaying your direct CSV columns: X, Y, Z, Stroke_mm, Temperature_C. 
            The system reads from your CSV structure: Device, Timestamp, X, Y, Z, Stroke_mm, Temperature_C.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
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