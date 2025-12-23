"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
  axis: 'x' | 'y' | 'z' | 'accel_x' | 'accel_y' | 'accel_z'
  title: string
  color: string
}

export function AccelerometerChart({ data, isLoading, axis, title, color }: AccelerometerChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
          <span className="text-slate-600">Loading {title} data...</span>
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
          <p className="text-sm font-semibold" style={{ color }}>
            {title}: {payload[0].value.toFixed(3)} g
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
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
            stroke="#64748b"
            fontSize={12}
            label={{ value: `${title} (g)`, angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="5 5" label="High Threshold" />
          <ReferenceLine y={-0.5} stroke="#ef4444" strokeDasharray="5 5" label="Low Threshold" />
          <Line
            type="monotone"
            dataKey={axis}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
