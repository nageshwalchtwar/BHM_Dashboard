"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from "recharts"
import { useEffect, useState, useRef, useLayoutEffect } from "react"


interface AccelerometerChartProps {
  data: any[]
  isLoading: boolean
  axis: 'x' | 'y' | 'z' | 'accel_x' | 'accel_y' | 'accel_z' | 'ax_adxl' | 'ay_adxl' | 'az_adxl' | 'ax_wt901' | 'ay_wt901' | 'az_wt901'
  title: string
  color: string
  chartKey?: string
  rms?: number // Pass the RMS value for this axis
}

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Measure container size after mount and on resize
  useLayoutEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Defensive: If data is missing or not an array, treat as empty and filter out invalid timestamps
  const safeData = Array.isArray(data) ? data.filter(d => typeof d.timestamp === 'number' && !isNaN(d.timestamp)) : [];

  // Detect if data is in RMS-per-second format (downsampled)
  const isRMSDownsampled = safeData.length > 0 && (
    safeData[0].accel_x_rms !== undefined || safeData[0].accel_y_rms !== undefined || safeData[0].accel_z_rms !== undefined
  );

  // If downsampled, use the RMS value for the selected axis
  const axisRMSKey = axis === 'ax_adxl' || axis === 'accel_x' ? 'accel_x_rms'
    : axis === 'ay_adxl' || axis === 'accel_y' ? 'accel_y_rms'
    : axis === 'az_adxl' || axis === 'accel_z' ? 'accel_z_rms'
    : undefined;

  // For downsampled RMS data, plot the RMS value as the main line
  const plotData = isRMSDownsampled && axisRMSKey
    ? safeData.map(d => ({ ...d, value: d[axisRMSKey] }))
    : safeData;

  // Step function transformation for non-downsampled data
  const stepData = (!isRMSDownsampled && safeData.length < 2) ? safeData :
    (!isRMSDownsampled ? safeData.flatMap((d, i) => {
      if (i === safeData.length - 1) return [d]
      return [d, { ...d, timestamp: safeData[i + 1].timestamp }]
    }) : plotData);

  const [zoomData, setZoomData] = useState({ startIndex: 0, endIndex: stepData.length - 1 })
  const [selectedValue, setSelectedValue] = useState<any>(null)

  // Zoom in/out handlers
  const zoomStep = Math.max(2, Math.floor((zoomData.endIndex - zoomData.startIndex) * 0.2))
  const canZoomIn = (zoomData.endIndex - zoomData.startIndex) > 10
  const canZoomOut = (zoomData.startIndex > 0 || zoomData.endIndex < stepData.length - 1)
  const handleZoomIn = () => {
    if (!canZoomIn) return
    setZoomData(prev => {
      const mid = Math.floor((prev.startIndex + prev.endIndex) / 2)
      const range = Math.floor((prev.endIndex - prev.startIndex) / 2)
      return {
        startIndex: Math.max(0, mid - Math.floor(range / 2)),
        endIndex: Math.min(stepData.length - 1, mid + Math.floor(range / 2))
      }
    })
  }
  const handleZoomOut = () => {
    setZoomData(prev => ({
      startIndex: Math.max(0, prev.startIndex - zoomStep),
      endIndex: Math.min(stepData.length - 1, prev.endIndex + zoomStep)
    }))
  }
  const handleResetZoom = () => {
    setZoomData({ startIndex: 0, endIndex: stepData.length - 1 })
  }

  // Only render chart if not loading and there is data

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

  // Defensive: Only render chart if container has valid size
  if (containerSize.width < 10 || containerSize.height < 10) {
    return (
      <div ref={containerRef} className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-400">Chart area not ready...</span>
      </div>
    );
  }

  if (!Array.isArray(data) || safeData.length === 0 || !stepData.some(d => typeof d[axis] === 'number')) {
    return (
      <div ref={containerRef} className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-500">No data available for this plot.</span>
      </div>
    )
  }

  const formatXAxis = (tickItem: any) => {
    if (typeof tickItem !== 'number' || isNaN(tickItem)) return '';
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
      // Defensive: Only set selectedValue if timestamp is valid
      if (typeof dataPoint.timestamp === 'number' && !isNaN(dataPoint.timestamp)) {
        setSelectedValue({
          value: actualValue,
          timestamp: dataPoint.timestamp,
          rawTimestamp: dataPoint.rawTimestamp
        })
      }
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600 mb-1">
            CSV Time: {dataPoint.rawTimestamp || (typeof label === 'number' && !isNaN(label) ? new Date(label).toLocaleTimeString('en-US', { hour12: false }) : 'N/A')}
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
  const visibleData = stepData.slice(
    Math.max(0, zoomData.startIndex),
    Math.min(stepData.length, zoomData.endIndex + 1)
  )
  const latest = visibleData.length > 0 ? visibleData[visibleData.length - 1] : null
  const oldest = visibleData.length > 0 ? visibleData[0] : null

  return (
    <div ref={containerRef} className="h-[380px] w-full">
      {/* Zoom controls */}
      <div className="flex gap-2 mb-1 justify-end">
        <button onClick={handleZoomIn} disabled={!canZoomIn} className="px-2 py-1 text-xs border rounded disabled:opacity-50">Zoom In</button>
        <button onClick={handleZoomOut} disabled={!canZoomOut} className="px-2 py-1 text-xs border rounded disabled:opacity-50">Zoom Out</button>
        <button onClick={handleResetZoom} className="px-2 py-1 text-xs border rounded">Reset</button>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={stepData.slice(zoomData.startIndex, zoomData.endIndex + 1)} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
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
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(3) : value}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type={isRMSDownsampled ? "monotone" : "stepAfter"}
            dataKey={isRMSDownsampled && axisRMSKey ? "value" : axis}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            name={isRMSDownsampled ? `${title} RMS` : title}
          />
          {/* RMS horizontal line overlay (for non-downsampled) */}
          {!isRMSDownsampled && typeof rms === 'number' && (
            <ReferenceLine y={rms} stroke="#6366f1" strokeDasharray="6 2" label={{ value: `RMS: ${rms.toFixed(4)} g`, position: 'right', fill: '#6366f1', fontSize: 10 }} />
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
