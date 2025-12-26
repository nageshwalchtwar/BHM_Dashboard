import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface PlotlyChartProps {
  data: any[]
  isLoading: boolean
  field: string
  title: string
  color: string
  unit?: string
  yRange?: [number, number] | null
  multiAxis?: boolean
}

export function PlotlyChart({ data, isLoading, field, title, color, unit = '', yRange = null, multiAxis = false }: PlotlyChartProps) {
  const plotData = useMemo(() => {
    if (!data || data.length === 0) return []
    const timestamps = data.map(item => new Date(item.timestamp))
    if (multiAxis) {
      // Plot accel_x, accel_y, accel_z together
      return [
        {
          x: timestamps,
          y: data.map(item => (typeof item.accel_x === 'number' ? item.accel_x : null)),
          type: 'scatter',
          mode: 'lines',
          name: 'accele_x',
          line: { color: '#3b82f6', width: 2 },
        },
        {
          x: timestamps,
          y: data.map(item => (typeof item.accel_y === 'number' ? item.accel_y : null)),
          type: 'scatter',
          mode: 'lines',
          name: 'accele_y',
          line: { color: '#f59e0b', width: 2 },
        },
        {
          x: timestamps,
          y: data.map(item => (typeof item.accel_z === 'number' ? item.accel_z : null)),
          type: 'scatter',
          mode: 'lines',
          name: 'accele_z',
          line: { color: '#8b5cf6', width: 2 },
        },
      ]
    } else {
      const values = data.map(item => {
        const v = item[field]
        return (typeof v === 'number' && !isNaN(v)) ? v : null
      })
      return [{
        x: timestamps,
        y: values,
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: title,
        line: {
          color: color,
          width: 2
        },
        marker: {
          color: color,
          size: 4
        },
        hovertemplate: `<b>${title}</b><br>` +
                      `Time: %{x}<br>` +
                      `Value: %{y:.4f} ${unit}<br>` +
                      '<extra></extra>'
      }]
    }
  }, [data, field, title, color, unit, multiAxis])

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
      gridcolor: '#e2e8f0',
      automargin: true
    },
    yaxis: {
      title: `${title} (${unit})`,
      showgrid: true,
      gridcolor: '#e2e8f0',
      tickformat: '.4f',
      hoverformat: '.4f',
      automargin: true,
      ...(yRange ? {range: yRange} : {})
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
  }), [title, unit, yRange])

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
    scrollZoom: true,
    doubleClick: 'reset+autosize',
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    toImageButtonOptions: {
      format: 'png',
      filename: 'chart',
      height: 400,
      width: 700,
      scale: 2
    }
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
