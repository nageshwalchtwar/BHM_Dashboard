"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LatestDataPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to main page since that's now where the charts are
    router.replace('/')
  }, [router])

  return (
    <div className="container mx-auto p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p>Taking you to the main dashboard with CSV file selector and charts.</p>
      </div>
    </div>
  )
}

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