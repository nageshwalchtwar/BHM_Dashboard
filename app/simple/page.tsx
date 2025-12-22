"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Activity, AlertTriangle } from "lucide-react"

export default function SimpleDashboard() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      console.log('📡 Fetching CSV data...')
      
      const response = await fetch('/api/simple-csv')
      const result = await response.json()
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`✅ Got ${result.data.length} data points`)
        setData(result.data)
        setError(null)
      } else {
        console.log('❌ No data:', result)
        setError('No CSV data found')
      }
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('❌ Error:', error)
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const latestData = data[data.length - 1]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bridge Health Monitor</h1>
          <p className="text-muted-foreground">
            Simple CSV data from Google Drive folder
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Data Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className={`text-lg ${error ? 'text-red-500' : data.length > 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                {error ? 'Error' : data.length > 0 ? 'Connected' : 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Data Points</p>
              <p className="text-lg font-semibold">{data.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Last Update</p>
              <p className="text-sm">{lastUpdate?.toLocaleTimeString() || 'Never'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Auto Refresh</p>
              <p className="text-sm text-green-500">Every 30s</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Latest Values */}
      {latestData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Vibration X</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{latestData.vibration?.x?.toFixed(3) || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">g</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Vibration Y</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{latestData.vibration?.y?.toFixed(3) || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">g</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Stroke</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{latestData.strain?.toFixed(2) || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">mm</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Temperature</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{latestData.temperature?.toFixed(1) || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">°C</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Raw Data Preview */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Data (Last 5 Points)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Vib X</th>
                    <th className="text-left p-2">Vib Y</th>
                    <th className="text-left p-2">Vib Z</th>
                    <th className="text-left p-2">Stroke</th>
                    <th className="text-left p-2">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(-5).reverse().map((point, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{new Date(point.timestamp).toLocaleTimeString()}</td>
                      <td className="p-2">{point.vibration?.x?.toFixed(3) || 'N/A'}</td>
                      <td className="p-2">{point.vibration?.y?.toFixed(3) || 'N/A'}</td>
                      <td className="p-2">{point.vibration?.z?.toFixed(3) || 'N/A'}</td>
                      <td className="p-2">{point.strain?.toFixed(2) || 'N/A'}</td>
                      <td className="p-2">{point.temperature?.toFixed(1) || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}