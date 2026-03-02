"use client"

import React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts"

interface TemperatureChartProps {
  data: any[]
  isLoading: boolean
  chartKey?: string
}

export const TemperatureChart = React.memo(function TemperatureChart({ data, isLoading, chartKey }: TemperatureChartProps) {
  const safeData = Array.isArray(data)
    ? data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp) && typeof d.temperature_c === 'number' && !isNaN(d.temperature_c))
    : []

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-600 rounded-full animate-pulse" />
          <span className="text-slate-600">Loading temperature data...</span>
        </div>
      </div>
    )
  }

  if (safeData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <span className="text-slate-600">No temperature data available</span>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    if (typeof tickItem !== 'number' || isNaN(tickItem)) return ''
    return new Date(tickItem).toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dp = payload[0].payload
      const val = dp.temperature_c
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
          <p className="text-slate-500">{dp.rawTimestamp || (typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour12: false }) : '')}</p>
          <p className="font-semibold text-orange-600">{typeof val === 'number' ? val.toFixed(2) : 'N/A'}°C</p>
        </div>
      )
    }
    return null
  }

  // Client-side safety cap (server already caps at 500)
  const MAX_PTS = 500
  const chartData = safeData.length > MAX_PTS
    ? safeData.filter((_, i) => i % Math.ceil(safeData.length / MAX_PTS) === 0)
    : safeData

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <LineChart width={1050} height={340} data={chartData} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" />
          <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10}
            label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: '10px' } }}
            tickFormatter={v => typeof v === 'number' ? v.toFixed(1) : v} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="5 5" label="Critical" />
          <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="5 5" label="Warning" />
          <Line type="monotone" dataKey="temperature_c" stroke="#ea580c" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </div>
      <div className="flex gap-4 text-xs text-gray-600 px-2 pt-1">
        <span><b>Points:</b> {chartData.length}</span>
        <span><b>Latest:</b> {chartData[chartData.length - 1]?.temperature_c?.toFixed(2)}°C</span>
      </div>
    </div>
  )
})
