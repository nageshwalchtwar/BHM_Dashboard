'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ADXLChartProps {
  data: Array<{
    timestamp: string
    ax_adxl?: number
    ay_adxl?: number
    az_adxl?: number
  }>
}

export function ADXLChart({ data }: ADXLChartProps) {
  const chartData = data.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString(),
    'X-Axis': item.ax_adxl || 0,
    'Y-Axis': item.ay_adxl || 0,
    'Z-Axis': item.az_adxl || 0
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
              `ADXL ${name}`
            ]}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="X-Axis" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            name="X-Axis"
          />
          <Line 
            type="monotone" 
            dataKey="Y-Axis" 
            stroke="#22c55e" 
            strokeWidth={2}
            dot={false}
            name="Y-Axis"
          />
          <Line 
            type="monotone" 
            dataKey="Z-Axis" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="Z-Axis"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}