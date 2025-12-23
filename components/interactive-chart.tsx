"use client"

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface InteractiveChartProps {
  data: any[]
  isLoading: boolean
  field: string
  title: string
  color: string
  unit?: string
}

export function InteractiveChart({ data, isLoading, field, title, color, unit = '' }: InteractiveChartProps) {
  const plotData = useMemo(() => {
    if (!data || data.length === 0) return []

    const timestamps = data.map(item => new Date(item.timestamp))
    const values = data.map(item => item[field] || 0)

    return [{
      x: timestamps,
      y: values,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: title,
      line: {
        color: color,
        width: 2
      },
      hovertemplate: `<b>${title}</b><br>` +
                    `Time: %{x}<br>` +
                    `Value: %{y:.3f} ${unit}<br>` +
                    '<extra></extra>'
    }]
  }, [data, field, title, color, unit])

  const layout = useMemo(() => ({
    title: {
      text: `${title} Data`,
      font: { size: 16, family: 'Inter, sans-serif' }
    },
    xaxis: {
      title: 'Time',
      type: 'date' as const,
      tickformat: '%H:%M:%S',
      showgrid: true,
      gridcolor: '#e2e8f0'
    },
    yaxis: {
      title: `${title} (${unit})`,
      showgrid: true,
      gridcolor: '#e2e8f0'
    },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    font: {
      family: 'Inter, sans-serif',
      size: 12
    },
    margin: { t: 50, r: 30, b: 50, l: 60 },
    hovermode: 'closest' as const,
    showlegend: false
  }), [title, unit])

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToAdd: [
      'pan2d',
      'select2d',
      'lasso2d',
      'autoScale2d'
    ],
    modeBarButtonsToRemove: [
      'toImage'
    ],
    displaylogo: false,
    scrollZoom: true
  }

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
          <span className="text-slate-600">Loading {title} data...</span>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="text-center">
          <div className="text-slate-600 mb-2">No {title} data available</div>
          <div className="text-sm text-slate-500">Try adjusting the time range</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[400px] w-full">
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
      />
    </div>
  )
}