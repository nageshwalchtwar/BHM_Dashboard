'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface WT901ChartProps {
  data: Array<{
    timestamp: string
    ax_wt901?: number
    ay_wt901?: number
    az_wt901?: number
  }>
}

export function WT901Chart({ data }: WT901ChartProps) {
  const chartData = data.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString(),
    'X-Axis': item.ax_wt901 || 0,
    'Y-Axis': item.ay_wt901 || 0,
    'Z-Axis': item.az_wt901 || 0
  }))

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Acceleration (g)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            labelFormatter={(value) => `Time: ${value}`}
            formatter={(value: any, name: string) => [
              typeof value === 'number' ? value.toFixed(4) : value,
              `WT901 ${name}`
            ]}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="X-Axis" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={false}
            name="X-Axis"
          />
          <Line 
            type="monotone" 
            dataKey="Y-Axis" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={false}
            name="Y-Axis"
          />
          <Line 
            type="monotone" 
            dataKey="Z-Axis" 
            stroke="#06b6d4" 
            strokeWidth={2}
            dot={false}
            name="Z-Axis"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}