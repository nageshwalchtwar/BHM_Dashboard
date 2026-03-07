"use client"

import React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Brush } from "recharts"

interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
  axis: 'x' | 'y' | 'z' | 'accel_x' | 'accel_y' | 'accel_z' | 'ax_adxl' | 'ay_adxl' | 'az_adxl' | 'ax_wt901' | 'ay_wt901' | 'az_wt901'
  title: string
  color: string
  chartKey?: string
  rms?: number
}

export const AccelerometerChart = React.memo(function AccelerometerChart({ data, isLoading, axis, title, color, chartKey, rms }: AccelerometerChartProps) {
  // Filter valid data points
  const safeData = Array.isArray(data)
    ? data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp) && typeof d[axis] === 'number' && !isNaN(d[axis]))
    : []

  // Client-side safety cap (server already caps at 500)
  const MAX_PTS = 500
  const chartData = safeData.length > MAX_PTS
    ? safeData.filter((_, i) => i % Math.ceil(safeData.length / MAX_PTS) === 0)
    : safeData

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-gray-600">Loading {title} data...</span>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-500">No data available for {title}.</span>
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
      const val = dp[axis]
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
          <p className="text-slate-500">{dp.rawTimestamp || (typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour12: false }) : '')}</p>
          <p className="font-semibold" style={{ color }}>{typeof val === 'number' ? val.toFixed(4) : 'N/A'} g</p>
        </div>
      )
    }
    return null
  }

  const oldest = chartData[0]
  const latest = chartData[chartData.length - 1]

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <LineChart width={1050} height={340} data={chartData} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#94a3b8"
            fontSize={10}
            label={{ value: `${title} (g)`, angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: '10px' } }}
            tickFormatter={v => typeof v === 'number' ? v.toFixed(3) : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey={axis} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {typeof rms === 'number' && (
            <ReferenceLine y={rms} stroke="#6366f1" strokeDasharray="6 2"
              label={{ value: `RMS: ${rms.toFixed(4)}g`, position: 'right', fill: '#6366f1', fontSize: 10 }} />
          )}
          <Brush dataKey="timestamp" height={30} stroke="#cbd5e1" tickFormatter={formatXAxis} fill="#f8fafc" />
        </LineChart>
      </div>
      <div className="flex gap-4 text-xs text-gray-600 px-2 pt-1">
        <span><b>Points:</b> {chartData.length} of {safeData.length}</span>
        <span><b>From:</b> {oldest?.rawTimestamp || new Date(oldest?.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
        <span><b>To:</b> {latest?.rawTimestamp || new Date(latest?.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
        <span><b>Oldest:</b> {oldest?.[axis]?.toFixed(4)}g</span>
        <span><b>Latest:</b> {latest?.[axis]?.toFixed(4)}g</span>
      </div>
    </div>
  )
})
