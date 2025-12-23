"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

interface VibrationChartProps {
  data: any[]
  isLoading: boolean
}

export function VibrationChart({ data, isLoading }: VibrationChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading vibration data...</span>
        </div>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    const date = new Date(tickItem)
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
      const actualValue = dataPoint.vibration || payload[0].value // Use the actual field value
      
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
          <p className="text-sm font-semibold text-blue-600">Vibration: {actualValue?.toFixed(3) || 'N/A'} g</p>
          <p className="text-xs text-slate-500">
            Raw timestamp: {new Date(dataPoint.timestamp).toLocaleTimeString()}
          </p>
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
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatXAxis} 
            stroke="#64748b" 
            fontSize={10}
            interval="preserveStartEnd"
            tick={{ angle: -45 }}
            height={60}
          />
          <YAxis
            domain={[0, 3]}
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Frequency (Hz)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="5 5" label="Critical Threshold" />
          <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="5 5" label="Warning Threshold" />
          <Line
            type="monotone"
            dataKey="vibration"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#2563eb" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
