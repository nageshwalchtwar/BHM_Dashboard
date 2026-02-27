"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts"
import { useState } from "react"

interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
  axis: 'x' | 'y' | 'z' | 'accel_x' | 'accel_y' | 'accel_z' | 'ax_adxl' | 'ay_adxl' | 'az_adxl' | 'ax_wt901' | 'ay_wt901' | 'az_wt901'
  title: string
  color: string
  chartKey?: string
}

export function AccelerometerChart({ data, isLoading, axis, title, color, chartKey }: AccelerometerChartProps) {
  const [zoomData, setZoomData] = useState({ startIndex: 0, endIndex: data.length - 1 })
  const [selectedValue, setSelectedValue] = useState<any>(null)

  if (isLoading) {
    return (
      <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
          <span className="text-gray-600">Loading {title} data...</span>
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
      const actualValue = dataPoint[axis] || payload[0].value // Use the actual field value
      setSelectedValue({
        value: actualValue,
        timestamp: dataPoint.timestamp,
        rawTimestamp: dataPoint.rawTimestamp
      })
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dataPoint.rawTimestamp || new Date(label).toLocaleTimeString('en-US', { hour12: false })}
          </p>
          <p className="text-sm font-semibold" style={{ color }}>
            {title}: {typeof actualValue === 'number' ? actualValue.toFixed(4) : 'N/A'} g
          </p>
        </div>
      )
    }
    return null
  }

  // Get visible data for zoom/brush
  const visibleData = data.slice(
    Math.max(0, zoomData.startIndex),
    Math.min(data.length, zoomData.endIndex + 1)
  )
  const latest = visibleData.length > 0 ? visibleData[visibleData.length - 1] : null
  const oldest = visibleData.length > 0 ? visibleData[0] : null

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatXAxis} 
            stroke="#64748b" 
            fontSize={10}
            interval="preserveStartEnd"
            height={60}
          />
          <YAxis
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
            stroke="#64748b"
            fontSize={10}
            label={{ value: `${title} (g)`, angle: -90, position: "insideLeft", style: { fontSize: '10px' } }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(3) : value}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={axis}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
          <Brush 
            dataKey="timestamp" 
            height={20} 
            stroke={color} 
            travellerWidth={8}
            onChange={(state: any) => setZoomData({ startIndex: state.startIndex, endIndex: state.endIndex })}
          />
        </LineChart>
      </ResponsiveContainer>
      {/* ThingSpeak-like value display */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs justify-between">
        <div>
          <span className="font-semibold">Oldest in view:</span> {oldest ? `${oldest[axis]?.toFixed(4)} g @ ${oldest.rawTimestamp || new Date(oldest.timestamp).toLocaleTimeString('en-US', { hour12: false })}` : 'N/A'}
        </div>
        <div>
          <span className="font-semibold">Latest in view:</span> {latest ? `${latest[axis]?.toFixed(4)} g @ ${latest.rawTimestamp || new Date(latest.timestamp).toLocaleTimeString('en-US', { hour12: false })}` : 'N/A'}
        </div>
        <div>
          <span className="font-semibold">Selected:</span> {selectedValue ? `${selectedValue.value?.toFixed(4)} g @ ${selectedValue.rawTimestamp || new Date(selectedValue.timestamp).toLocaleTimeString('en-US', { hour12: false })}` : 'Click/hover chart'}
        </div>
      </div>
    </div>
  )
}
