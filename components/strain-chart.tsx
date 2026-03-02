"use client"

import React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

interface StrainChartProps {
  data: any[]
  isLoading: boolean
  chartKey?: string
}

export const StrainChart = React.memo(function StrainChart({ data, isLoading, chartKey }: StrainChartProps) {
  const safeData = Array.isArray(data)
    ? data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp) && typeof d.stroke_mm === 'number' && !isNaN(d.stroke_mm))
    : []

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-600 rounded-full animate-pulse" />
          <span className="text-slate-600">Loading stroke data...</span>
        </div>
      </div>
    )
  }

  if (safeData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <span className="text-slate-600">No stroke data available</span>
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
      const val = dp.stroke_mm
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
          <p className="text-slate-500">{dp.rawTimestamp || (typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour12: false }) : '')}</p>
          <p className="font-semibold text-purple-600">{typeof val === 'number' ? val.toFixed(4) : 'N/A'} mm</p>
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
            label={{ value: 'Stroke (mm)', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: '10px' } }}
            tickFormatter={v => typeof v === 'number' ? v.toFixed(3) : v} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="stroke_mm" stroke="#7c3aed" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </div>
      <div className="flex gap-4 text-xs text-gray-600 px-2 pt-1">
        <span><b>Points:</b> {chartData.length}</span>
        <span><b>Latest:</b> {chartData[chartData.length - 1]?.stroke_mm?.toFixed(4)} mm</span>
      </div>
    </div>
  )
})
