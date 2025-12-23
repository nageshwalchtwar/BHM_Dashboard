"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

interface StrainChartProps {
  data: any[]
  isLoading: boolean
}

export function StrainChart({ data, isLoading }: StrainChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading strain data...</span>
        </div>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    const date = new Date(tickItem)
    // For time-only data from CSV, show just HH:MM:SS format
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            {new Date(label).toLocaleTimeString('en-US', { 
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </p>
          <p className="text-sm font-semibold text-purple-600">Stroke: {payload[0].value.toFixed(2)} mm</p>
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
            domain={[0, 300]}
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Strain (μɛ)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="5 5" label="Critical Threshold" />
          <ReferenceLine y={150} stroke="#f59e0b" strokeDasharray="5 5" label="Warning Threshold" />
          <Line
            type="monotone"
            dataKey="stroke_mm"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#7c3aed" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
