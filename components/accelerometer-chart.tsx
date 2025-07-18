"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
}

export function AccelerometerChart({ data, isLoading }: AccelerometerChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading acceleration data...</span>
        </div>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    const date = new Date(tickItem)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">{new Date(label).toLocaleString()}</p>
          <p className="text-sm font-semibold text-emerald-600">Acceleration: {payload[0].value.toFixed(2)} m/s²</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke="#64748b" fontSize={12} />
          <YAxis
            domain={[0, 1]}
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Acceleration (m/s²)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="5 5" label="Critical Threshold" />
          <ReferenceLine y={0.35} stroke="#f59e0b" strokeDasharray="5 5" label="Warning Threshold" />
          <Line
            type="monotone"
            dataKey="acceleration"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#059669" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
