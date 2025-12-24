"use client"

import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Brush } from "recharts"

interface ThreeAxisAccelerationChartProps {
  data: any[]
  isLoading: boolean
}

export function ThreeAxisAccelerationChart({ data, isLoading }: ThreeAxisAccelerationChartProps) {
  const [zoomData, setZoomData] = useState({ startIndex: 0, endIndex: data.length - 1 })
  
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading 3-axis acceleration data...</span>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <span className="text-slate-600">No acceleration data available</span>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    const date = new Date(tickItem)
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-2">
            Time: {dataPoint.rawTimestamp || new Date(label).toLocaleTimeString('en-US', { hour12: false })}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
                {entry.name}: {entry.value?.toFixed(3) || 'N/A'} g
              </p>
            ))}
          </div>
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
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Acceleration (g)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          
          {/* Zero baseline reference line */}
          <ReferenceLine 
            y={0} 
            stroke="#000000" 
            strokeWidth={2}
            strokeDasharray="0"
            label={{ value: "Zero", position: "right", fill: "#000000" }}
          />
          
          {/* X Axis - Blue */}
          <Line
            type="monotone"
            dataKey="accel_x"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6" }}
            name="X Axis"
            isAnimationActive={false}
          />
          
          {/* Y Axis - Yellow */}
          <Line
            type="monotone"
            dataKey="accel_y"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#f59e0b" }}
            name="Y Axis"
            isAnimationActive={false}
          />
          
          {/* Z Axis - Purple */}
          <Line
            type="monotone"
            dataKey="accel_z"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#8b5cf6" }}
            name="Z Axis"
            isAnimationActive={false}
          />
          
          <Brush 
            dataKey="timestamp" 
            height={30} 
            stroke="#6366f1"
            fill="#e0e7ff"
            travellerWidth={8}
            onChange={(state: any) => setZoomData({ startIndex: state.startIndex, endIndex: state.endIndex })}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
