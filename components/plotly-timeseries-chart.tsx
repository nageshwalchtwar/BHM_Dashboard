"use client"

import React, { useMemo, useState } from "react"
import dynamic from "next/dynamic"

// @ts-ignore - react-plotly.js types resolved at runtime
const Plot = dynamic(() => import("react-plotly.js").then((mod) => mod.default || mod), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
      <span className="text-gray-500 text-sm">Loading chart library...</span>
    </div>
  ),
}) as any

interface PlotlyTimeSeriesChartProps {
  data: any[]
  isLoading: boolean
  dataKey: string
  title: string
  yAxisLabel: string
  color: string
  unit?: string
  rms?: number
  referenceLines?: { y: number; color: string; label: string }[]
  timeRange?: string // minutes as string: "1", "60", "1440", "10080"
}

export const PlotlyTimeSeriesChart = React.memo(function PlotlyTimeSeriesChart({
  data,
  isLoading,
  dataKey,
  title,
  yAxisLabel,
  color,
  unit = "",
  rms,
  referenceLines,
  timeRange,
}: PlotlyTimeSeriesChartProps) {
  const [isClient, setIsClient] = useState(false)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  const { plotData, plotLayout } = useMemo(() => {
    const safeData = Array.isArray(data)
      ? data.filter(
          (d) =>
            typeof d.timestamp === "number" &&
            !isNaN(d.timestamp) &&
            typeof d[dataKey] === "number" &&
            !isNaN(d[dataKey])
        )
      : []

    // Sort by timestamp ascending for Plotly
    const sorted = [...safeData].sort((a, b) => a.timestamp - b.timestamp)

    // Build arrays with null gaps where time jumps significantly
    // This prevents Plotly from drawing spikes across data gaps
    const timestamps: (string | null)[] = []
    const values: (number | null)[] = []

    // Detect typical interval from first few points
    let medianGap = 10000 // default 10s
    if (sorted.length > 2) {
      const gaps: number[] = []
      for (let i = 1; i < Math.min(sorted.length, 50); i++) {
        gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp)
      }
      gaps.sort((a, b) => a - b)
      medianGap = gaps[Math.floor(gaps.length / 2)]
    }
    const gapThreshold = Math.max(medianGap * 3, 30000) // 3x median or 30s minimum

    for (let i = 0; i < sorted.length; i++) {
      // Always push timestamp and value, do not insert nulls for gaps
      timestamps.push(new Date(sorted[i].timestamp).toISOString().slice(0, -1))
      values.push(sorted[i][dataKey])
    }

    // Dynamic time format based on range
    const mins = parseInt(timeRange || "1", 10) || 10080 // 'custom' parses to NaN → treat as multi-day
    const tickFmt = mins >= 1440 ? "%b %d %H:%M" : mins >= 60 ? "%H:%M" : "%H:%M:%S"
    const hoverFmt = mins >= 1440 ? "%b %d %H:%M:%S" : "%H:%M:%S.%L"

    const traces: any[] = [
      {
        x: timestamps,
        y: values,
        type: "scattergl",
        mode: "lines",
        name: title,
        line: { color, width: 1.5 },
        connectgaps: false,
        hovertemplate:
          `<b>${title}</b><br>` +
          `Time: %{x|${hoverFmt}}<br>` +
          `Value: %{y:.4f} ${unit}<br>` +
          "<extra></extra>",
      },
    ]

    // Add RMS reference line
    const firstTs = timestamps.find(t => t !== null)
    const lastTs = [...timestamps].reverse().find(t => t !== null)
    if (typeof rms === "number" && firstTs && lastTs) {
      traces.push({
        x: [firstTs, lastTs],
        y: [rms, rms],
        type: "scatter",
        mode: "lines",
        name: `RMS: ${rms.toFixed(4)} ${unit}`,
        line: { color: "#6366f1", width: 1.5, dash: "dash" },
        hovertemplate: `RMS: ${rms.toFixed(4)} ${unit}<extra></extra>`,
      })
    }

    // Add custom reference lines (e.g., warning/critical for temperature)
    if (referenceLines && firstTs && lastTs) {
      referenceLines.forEach((ref) => {
        traces.push({
          x: [firstTs, lastTs],
          y: [ref.y, ref.y],
          type: "scatter",
          mode: "lines",
          name: ref.label,
          line: { color: ref.color, width: 1, dash: "dash" },
          hovertemplate: `${ref.label}: ${ref.y} ${unit}<extra></extra>`,
        })
      })
    }

    const layout: any = {
      title: {
        text: title,
        font: { size: 14, family: "Inter, sans-serif" },
        x: 0.02,
        xanchor: "left",
      },
      xaxis: {
        title: { text: "Time", font: { size: 11 } },
        type: "date",
        tickformat: tickFmt,
        showgrid: true,
        gridcolor: "#f1f5f9",
        showspikes: true,
        spikemode: "across",
        spikethickness: 1,
        spikecolor: "#94a3b8",
        spikedash: "dot",
        rangeslider: { visible: false },
        automargin: true,
      },
      yaxis: {
        title: { text: yAxisLabel, font: { size: 11 } },
        showgrid: true,
        gridcolor: "#f1f5f9",
        tickformat: ".4f",
        hoverformat: ".6f",
        automargin: true,
        fixedrange: false,
      },
      margin: { t: 40, r: 20, b: 30, l: 60 },
      hovermode: "x unified",
      plot_bgcolor: "white",
      paper_bgcolor: "white",
      font: { family: "Inter, sans-serif", size: 11 },
      showlegend: traces.length > 1,
      legend: {
        x: 1,
        y: 1,
        xanchor: "right",
        yanchor: "top",
        bgcolor: "rgba(255,255,255,0.85)",
        bordercolor: "#e2e8f0",
        borderwidth: 1,
        font: { size: 10 },
      },
      dragmode: "zoom",
      selectdirection: "h",
    }

    return { plotData: traces, plotLayout: layout }
  }, [data, dataKey, title, yAxisLabel, color, unit, rms, referenceLines, timeRange])

  const config = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToAdd: [
        "select2d",
        "lasso2d",
      ] as any[],
      modeBarButtonsToRemove: ["toImage", "sendDataToCloud"] as any[],
      doubleClick: "reset+autosize" as const,
      toImageButtonOptions: {
        format: "png" as const,
        filename: `bhm_${title.replace(/\s+/g, "_").toLowerCase()}`,
        height: 600,
        width: 1200,
        scale: 2,
      },
    }),
    [title]
  )

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-gray-600 text-sm">Loading {title} data...</span>
        </div>
      </div>
    )
  }

  const safeCount = Array.isArray(data)
    ? data.filter(
        (d) => typeof d[dataKey] === "number" && !isNaN(d[dataKey])
      ).length
    : 0

  if (safeCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-500 text-sm">No data available for {title}</span>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-gray-500 text-sm">Initializing chart...</span>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      <Plot
        data={plotData}
        layout={plotLayout}
        config={config}
        useResizeHandler={true}
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute bottom-0 left-0 right-0 flex gap-4 text-xs text-gray-500 px-2 pb-1">
        <span><b>Points:</b> {safeCount}</span>
        <span className="text-gray-400">Drag to zoom • Scroll to zoom • Double-click to reset</span>
      </div>
    </div>
  )
})
