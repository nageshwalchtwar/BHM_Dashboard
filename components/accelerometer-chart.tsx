"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts"
import { useState, useRef, useLayoutEffect } from "react"

interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
  axis: 'x' | 'y' | 'z' | 'accel_x' | 'accel_y' | 'accel_z' | 'ax_adxl' | 'ay_adxl' | 'az_adxl' | 'ax_wt901' | 'ay_wt901' | 'az_wt901'
  title: string
  color: string
  chartKey?: string
  rms?: number
}

export function AccelerometerChart({ data, isLoading, axis, title, color, chartKey, rms }: AccelerometerChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [zoomData, setZoomData] = useState({ startIndex: 0, endIndex: 0 })

  // Measure container size after mount and on resize
  useLayoutEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Defensive: filter out invalid timestamps
  const safeData = Array.isArray(data) ? data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp)) : []

  // Limit data points to prevent browser crash (max 2000 points for chart)
  const MAX_CHART_POINTS = 2000
  const chartSafeData = safeData.length > MAX_CHART_POINTS
    ? safeData.filter((_, i) => i % Math.ceil(safeData.length / MAX_CHART_POINTS) === 0)
    : safeData

  // Check if there is valid data for the requested axis
  const hasAxisData = chartSafeData.some(d => typeof d[axis] === 'number' && !isNaN(d[axis]))

  // Zoom handlers
  const effectiveEnd = chartSafeData.length - 1
  const zoomStep = Math.max(2, Math.floor((zoomData.endIndex - zoomData.startIndex) * 0.2))
  const canZoomIn = (zoomData.endIndex - zoomData.startIndex) > 10
  const canZoomOut = (zoomData.startIndex > 0 || zoomData.endIndex < effectiveEnd)

  const handleZoomIn = () => {
    if (!canZoomIn) return
    setZoomData(prev => {
      const mid = Math.floor((prev.startIndex + prev.endIndex) / 2)
      const range = Math.floor((prev.endIndex - prev.startIndex) / 2)
      return {
        startIndex: Math.max(0, mid - Math.floor(range / 2)),
        endIndex: Math.min(effectiveEnd, mid + Math.floor(range / 2))
      }
    })
  }
  const handleZoomOut = () => {
    setZoomData(prev => ({
      startIndex: Math.max(0, prev.startIndex - zoomStep),
      endIndex: Math.min(effectiveEnd, prev.endIndex + zoomStep)
    }))
  }
  const handleResetZoom = () => {
    setZoomData({ startIndex: 0, endIndex: effectiveEnd })
  }

  // --- Early returns for loading / no-data / container-not-ready ---

  if (isLoading) {
    return (
      <div ref={containerRef} className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
          <span className="text-gray-600">Loading {title} data...</span>
        </div>
      </div>
    )
  }

  if (containerSize.width < 10 || containerSize.height < 10) {
    return (
      <div ref={containerRef} className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-400">Preparing chart...</span>
      </div>
    )
  }

  if (!hasAxisData) {
    return (
      <div ref={containerRef} className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-500">No data available for this plot.</span>
      </div>
    )
  }

  // --- Helpers ---

  const formatXAxis = (tickItem: any) => {
    if (typeof tickItem !== 'number' || isNaN(tickItem)) return ''
    const date = new Date(tickItem)
    return date.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dp = payload[0].payload
      const val = dp[axis] ?? payload[0].value
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dp.rawTimestamp || (typeof label === 'number' ? new Date(label).toLocaleTimeString('en-US', { hour12: false }) : 'N/A')}
          </p>
          <p className="text-sm font-semibold" style={{ color }}>
            {title}: {typeof val === 'number' ? val.toFixed(4) : 'N/A'} g
          </p>
        </div>
      )
    }
    return null
  }

  const slicedData = chartSafeData.slice(
    Math.max(0, zoomData.startIndex),
    Math.min(chartSafeData.length, zoomData.endIndex + 1)
  )
  const chartData = slicedData.length > 0 ? slicedData : chartSafeData
  const latest = chartData[chartData.length - 1]
  const oldest = chartData[0]

  return (
    <div ref={containerRef} className="h-[380px] w-full">
      <div className="flex gap-2 mb-1 justify-end">
        <button onClick={handleZoomIn} disabled={!canZoomIn} className="px-2 py-1 text-xs border rounded disabled:opacity-50">Zoom In</button>
        <button onClick={handleZoomOut} disabled={!canZoomOut} className="px-2 py-1 text-xs border rounded disabled:opacity-50">Zoom Out</button>
        <button onClick={handleResetZoom} className="px-2 py-1 text-xs border rounded">Reset</button>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
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
            label={{ value: `${title} (g)`, angle: -90, position: "insideLeft", offset: 20, style: { fontSize: '10px' } }}
            tickFormatter={(v) => typeof v === 'number' ? v.toFixed(3) : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="stepAfter"
            dataKey={axis}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            name={title}
          />
          {typeof rms === 'number' && (
            <ReferenceLine
              y={rms}
              stroke="#6366f1"
              strokeDasharray="6 2"
              label={{ value: `RMS: ${rms.toFixed(4)} g`, position: 'right', fill: '#6366f1', fontSize: 10 }}
            />
          )}
          <Brush
            dataKey="timestamp"
            height={20}
            stroke={color}
            travellerWidth={8}
            onChange={(state: any) => setZoomData({ startIndex: state.startIndex, endIndex: state.endIndex })}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 mt-2 text-xs justify-between">
        <div>
          <span className="font-semibold">Oldest in view:</span>{' '}
          {oldest ? `${oldest[axis]?.toFixed(4)} g @ ${oldest.rawTimestamp || new Date(oldest.timestamp).toLocaleTimeString('en-US', { hour12: false })}` : 'N/A'}
        </div>
        <div>
          <span className="font-semibold">Latest in view:</span>{' '}
          {latest ? `${latest[axis]?.toFixed(4)} g @ ${latest.rawTimestamp || new Date(latest.timestamp).toLocaleTimeString('en-US', { hour12: false })}` : 'N/A'}
        </div>
        <div>
          <span className="font-semibold">Points:</span> {chartData.length}
        </div>
      </div>
    </div>
  )
}
