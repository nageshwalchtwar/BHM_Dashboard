"use client"

import { useState, useEffect } from "react"
import { Activity, Thermometer, Zap, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { VibrationChart } from "@/components/vibration-chart"
import { AccelerometerChart } from "@/components/accelerometer-chart"
import { StrainChart } from "@/components/strain-chart"
import { TemperatureChart } from "@/components/temperature-chart"
import { generateSensorData, calculateHealthStatus } from "@/lib/data-generator"
import type { DateRange } from "react-day-picker"
import { useRouter } from "next/navigation";

export default function HistoricalDashboard() {
  const router = useRouter();
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (!isLoggedIn) {
        router.replace("/login");
      }
    }
  }, [router]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    to: new Date(),
  })

  const [sensorData, setSensorData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    const loadData = () => {
      setIsLoading(true)
      const data = generateSensorData(
        dateRange?.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        dateRange?.to || new Date(),
      )
      setSensorData(data)
      const healthStatus = calculateHealthStatus(data)
      setLastUpdate(new Date())
      setIsLoading(false)
    }

    loadData()
    
    const interval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [dateRange])

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-5 h-5" />
      case "warning":
        return <AlertTriangle className="w-5 h-5" />
      case "critical":
        return <XCircle className="w-5 h-5" />
      default:
        return <Activity className="w-5 h-5" />
    }
  }

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case "good":
        return "OPERATIONAL"
      case "warning":
        return "ATTENTION REQUIRED"
      case "critical":
        return "CRITICAL ALERT"
      default:
        return "UNKNOWN"
    }
  }

  const latestData = sensorData[sensorData.length - 1] || {}
  const healthStatus = calculateHealthStatus(sensorData);
  const statusMap = {
    good: { color: "bg-green-500", label: "Healthy" },
    warning: { color: "bg-orange-400", label: "Warning" },
    critical: { color: "bg-red-600", label: "Critical" },
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="w-full flex items-center justify-between px-12 py-6 bg-white border-b">
        <div className="flex items-center gap-4">
          <span className={`h-5 w-5 rounded-full ${statusMap[healthStatus].color}`}></span>
          <span className="text-2xl font-bold text-gray-800">Bridge Health Status: <span className={`font-bold ${statusMap[healthStatus].color} text-white px-3 py-1 rounded`}>{statusMap[healthStatus].label}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to CSV Selector
          </a>
          <button onClick={handleLogout} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base font-semibold hover:bg-blue-700 transition">Logout</button>
        </div>
      </header>
      <main className="w-full max-w-[1600px] mx-auto px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Historical Data Dashboard</h1>
            <p className="text-lg text-gray-600">Generated historical sensor data for demonstration</p>
          </div>
          <div className="flex items-center gap-4">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
        </div>
        
        {/* Rest of the historical dashboard content... */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Vibration</CardTitle>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-slate-900">{latestData.vibration?.toFixed(2) || "0.00"}</div>
              <div className="text-sm text-slate-500">Hz</div>
            </CardContent>
          </Card>
          {/* Add other metric cards as needed */}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <VibrationChart data={sensorData} />
          <AccelerometerChart data={sensorData} />
          <StrainChart data={sensorData} />
          <TemperatureChart data={sensorData} />
        </div>
      </main>
    </div>
  )
}