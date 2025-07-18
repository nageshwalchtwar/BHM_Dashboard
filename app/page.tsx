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

export default function BridgeHealthDashboard() {
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

    // Simulate real-time updates every 10 seconds
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [dateRange])

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "bg-emerald-500 hover:bg-emerald-600"
      case "warning":
        return "bg-amber-500 hover:bg-amber-600"
      case "critical":
        return "bg-red-500 hover:bg-red-600"
      default:
        return "bg-slate-500"
    }
  }

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

  // Calculate health status (already present)
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
        <button onClick={handleLogout} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base font-semibold hover:bg-blue-700 transition">Logout</button>
      </header>
      <main className="w-full max-w-[1600px] mx-auto px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Bridge Health Monitoring Dashboard</h1>
            <p className="text-lg text-gray-600">Real-time structural integrity monitoring & analysis</p>
          </div>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Metric Cards - keep clean, no extra borders/shadows */}
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
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${latestData.vibration > 2.0 ? "bg-red-500" : latestData.vibration > 1.5 ? "bg-amber-500" : "bg-emerald-500"}`}
                ></div>
                <span className="text-xs text-slate-600">Normal: 0.5-2.0 Hz</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                Acceleration
              </CardTitle>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-slate-900">{latestData.acceleration?.toFixed(2) || "0.00"}</div>
              <div className="text-sm text-slate-500">m/s²</div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${latestData.acceleration > 0.5 ? "bg-red-500" : latestData.acceleration > 0.35 ? "bg-amber-500" : "bg-emerald-500"}`}
                ></div>
                <span className="text-xs text-slate-600">Normal: 0.1-0.5 m/s²</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Strain</CardTitle>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-slate-900">{latestData.strain?.toFixed(0) || "0"}</div>
              <div className="text-sm text-slate-500">μɛ</div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${latestData.strain > 200 ? "bg-red-500" : latestData.strain > 150 ? "bg-amber-500" : "bg-emerald-500"}`}
                ></div>
                <span className="text-xs text-slate-600">Normal: 50-200 μɛ</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                Temperature
              </CardTitle>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold text-slate-900">{latestData.temperature?.toFixed(1) || "0.0"}</div>
              <div className="text-sm text-slate-500">°C</div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${latestData.temperature > 35 ? "bg-red-500" : latestData.temperature > 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                ></div>
                <span className="text-xs text-slate-600">Normal: 15-35°C</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Vibration Analysis</CardTitle>
                  <CardDescription className="text-slate-600">Frequency measurements over time</CardDescription>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <VibrationChart data={sensorData} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Accelerometer Data</CardTitle>
                  <CardDescription className="text-slate-600">Acceleration measurements in m/s²</CardDescription>
                </div>
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <AccelerometerChart data={sensorData} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Strain Measurements</CardTitle>
                  <CardDescription className="text-slate-600">Structural strain in microstrains (μɛ)</CardDescription>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <StrainChart data={sensorData} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Temperature Monitoring</CardTitle>
                  <CardDescription className="text-slate-600">Environmental temperature in Celsius</CardDescription>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Thermometer className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TemperatureChart data={sensorData} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>

        {/* Health Status Analysis */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">System Health Analysis</h2>
          <Card className="border-0 shadow-lg bg-white">
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                    <span className="font-semibold text-emerald-900">OPERATIONAL</span>
                  </div>
                  <p className="text-sm text-emerald-700">All parameters within normal operating limits</p>
                  <div className="mt-3 text-xs text-emerald-600">✓ Structural integrity maintained</div>
                </div>

                <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                    <span className="font-semibold text-amber-900">ATTENTION REQUIRED</span>
                  </div>
                  <p className="text-sm text-amber-700">Some parameters approaching threshold limits</p>
                  <div className="mt-3 text-xs text-amber-600">⚠ Increased monitoring recommended</div>
                </div>

                <div className="p-6 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center gap-3 mb-3">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <span className="font-semibold text-red-900">CRITICAL ALERT</span>
                  </div>
                  <p className="text-sm text-red-700">Parameters exceed safe operational limits</p>
                  <div className="mt-3 text-xs text-red-600">🚨 Immediate inspection required</div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Current System Status</h4>
                  <Badge className={`${getHealthStatusColor(healthStatus)} text-white border-0 px-4 py-2 font-semibold`}>
                    {getHealthStatusIcon(healthStatus)}
                    <span className="ml-2">{getHealthStatusText(healthStatus)}</span>
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Data Points:</span>
                    <div className="font-semibold text-slate-900">{sensorData.length}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Monitoring Period:</span>
                    <div className="font-semibold text-slate-900">
                      {Math.ceil((Date.now() - (dateRange?.from?.getTime() || 0)) / (1000 * 60 * 60 * 24))} days
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Update Frequency:</span>
                    <div className="font-semibold text-slate-900">10 seconds</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Data Source:</span>
                    <div className="font-semibold text-slate-900">ThingSpeak API</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
