"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts"

interface TemperatureChartProps {
  data: any[]
  isLoading: boolean
}

export function TemperatureChart({ data, isLoading }: TemperatureChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading temperature data...</span>
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
      const actualValue = dataPoint.temperature_c || payload[0].value // Use the actual field value
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dataPoint.rawTimestamp || new Date(label).toLocaleTimeString('en-US', { hour12: false })}
          </p>
          <p className="text-sm font-semibold text-orange-600">Temperature: {typeof actualValue === 'number' ? actualValue.toFixed(4) : 'N/A'}°C</p>
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
            height={60}
          />
          <YAxis
            domain={[10, 40]}
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft" }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(4) : value}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="5 5" label="Critical Threshold" />
          <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="5 5" label="Warning Threshold" />
          <Line
            type="monotone"
            dataKey="temperature_c"
            stroke="#ea580c"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ea580c" }}
          />
          <Brush dataKey="timestamp" height={24} stroke="#ea580c" travellerWidth={12} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
