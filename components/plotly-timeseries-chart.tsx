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
  /**
   * When true, renders the trace as a filled area chart (like the green ADXL chart).
   * Defaults to true for the primary trace.
   */
  filled?: boolean
  /**
   * Fill color (rgba string). Defaults to a semi-transparent version of `color`.
   * Example: "rgba(0,200,150,0.35)"
   */
  fillColor?: string
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
  filled = true,
  fillColor,
}: PlotlyTimeSeriesChartProps) {
  const [isClient, setIsClient] = useState(false)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  /** Convert a hex or named color to an rgba string for the fill */
  const resolveFillColor = (baseColor: string): string => {
    if (fillColor) return fillColor
    // If already rgba/rgb, just lower opacity
    if (baseColor.startsWith("rgba")) return baseColor.replace(/[\d.]+\)$/, "0.30)")
    if (baseColor.startsWith("rgb(")) return baseColor.replace("rgb(", "rgba(").replace(")", ", 0.30)")
    // Hex → rgba
    const hex = baseColor.replace("#", "")
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgba(${r},${g},${b},0.30)`
    }
    return "rgba(0,200,150,0.30)"
  }

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

    const timestamps: (string | null)[] = []
    const values: (number | null)[] = []

    // Check if timestamps are properly spaced (should be at least 500ms apart for RMS data)
    let hasProperSpacing = true
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp
      if (timeDiff < 500) {
        hasProperSpacing = false
        break
      }
    }

    // If timestamps are not properly spaced, reconstruct them with 1-second intervals
    if (!hasProperSpacing && sorted.length > 0) {
      const baseTimestamp = sorted[0].timestamp
      for (let i = 0; i < sorted.length; i++) {
        // Assign each point a timestamp 1 second apart, starting from base time
        const syntheticTs = baseTimestamp + i * 1000
        timestamps.push(new Date(syntheticTs).toISOString().slice(0, -1))
        values.push(sorted[i][dataKey])
      }
    } else {
      // Use original timestamps if they're properly spaced
      for (let i = 0; i < sorted.length; i++) {
        timestamps.push(new Date(sorted[i].timestamp).toISOString().slice(0, -1))
        values.push(sorted[i][dataKey])
      }
    }

    // Dynamic time format based on range
    const mins = parseInt(timeRange || "1", 10) || 10080
    const tickFmt = mins >= 1440 ? "%b %d %H:%M" : mins >= 60 ? "%H:%M" : "%H:%M:%S"
    const hoverFmt = mins >= 1440 ? "%b %d %H:%M:%S" : "%H:%M:%S.%L"

    // ── Primary trace: stem plot (vertical lines from each point to zero) ──────────────────
    const traces: any[] = []

    // Create vertical stems: for each point, add a vertical line from 0 to value (separated by nulls)
    const stemTimestamps: (string | null)[] = []
    const stemValues: (number | null)[] = []

    for (let i = 0; i < timestamps.length; i++) {
      stemTimestamps.push(timestamps[i])
      stemValues.push(0) // Start from baseline
      stemTimestamps.push(timestamps[i])
      stemValues.push(values[i]) // Go up to actual value
      stemTimestamps.push(null) // Separator to prevent horizontal connection
      stemValues.push(null)
    }

    // Vertical stems trace - thin, crisp lines with no horizontal connections
    const stemsTrace: any = {
      x: stemTimestamps,
      y: stemValues,
      type: "scatter",
      mode: "lines",
      name: title,
      line: {
        color: color,
        width: 1.5,
        shape: "linear",
      },
      connectgaps: false,
      hovertemplate:
        `<b>${title}</b><br>` +
        `Time: %{x|${hoverFmt}}<br>` +
        `Value: %{y:.4f} ${unit}<br>` +
        "<extra></extra>",
      showlegend: true,
    }

    traces.push(stemsTrace)

    // Add prominent markers at the peak of each stem
    const markersTrace: any = {
      x: timestamps,
      y: values,
      type: "scatter",
      mode: "markers",
      marker: {
        size: 7,
        color: color,
        opacity: 1.0,
        line: {
          color: "white",
          width: 1.5,
        },
      },
      hovertemplate:
        `<b>${title}</b><br>` +
        `Time: %{x|${hoverFmt}}<br>` +
        `Value: %{y:.4f} ${unit}<br>` +
        "<extra></extra>",
      showlegend: false,
    }

    traces.push(markersTrace)

    // ── RMS dashed reference line ───────────────────────────────────────────
    const firstTs = timestamps.find((t) => t !== null)
    const lastTs = [...timestamps].reverse().find((t) => t !== null)

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

    // ── Custom reference lines ──────────────────────────────────────────────
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

    // ── Layout ──────────────────────────────────────────────────────────────
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
        rangemode: "tozero", // y-axis always starts at 0 — matches the screenshot
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dataKey, title, yAxisLabel, color, unit, rms, referenceLines, timeRange, filled, fillColor])

  const config = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToAdd: ["select2d", "lasso2d"] as any[],
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
    ? data.filter((d) => typeof d[dataKey] === "number" && !isNaN(d[dataKey])).length
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
        <span>
          <b>Points:</b> {safeCount}
        </span>
        <span className="text-gray-400">Drag to zoom • Scroll to zoom • Double-click to reset</span>
      </div>
    </div>
  )
})
