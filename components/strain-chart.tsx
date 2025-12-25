"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

interface StrainChartProps {
  data: any[]
  isLoading: boolean
}

export function StrainChart({ data, isLoading }: StrainChartProps) {
  // Debug stroke data
  if (data && data.length > 0) {
    console.log('🔧 Stroke chart data:', {
      totalPoints: data.length,
      firstPoint: {
        stroke_mm: data[0]?.stroke_mm,
        timestamp: new Date(data[0]?.timestamp).toLocaleString()
      },
      lastPoint: {
        stroke_mm: data[data.length - 1]?.stroke_mm,
        timestamp: new Date(data[data.length - 1]?.timestamp).toLocaleString()
      },
      strokeValues: data.slice(0, 5).map(d => d.stroke_mm)
    })
  }

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Loading stroke data...</span>
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
      const actualValue = dataPoint.stroke_mm || payload[0].value // Use the actual field value
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dataPoint.rawTimestamp || new Date(label).toLocaleTimeString('en-US', { hour12: false })}
          </p>
          <p className="text-sm font-semibold text-purple-600">Stroke: {typeof actualValue === 'number' ? actualValue.toFixed(4) : 'N/A'} mm</p>
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
            label={{ value: "Stroke (mm)", angle: -90, position: "insideLeft" }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(4) : value}
          />
          <Tooltip content={<CustomTooltip />} />
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
