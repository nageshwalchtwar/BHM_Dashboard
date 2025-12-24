"use client"

import { useMemo, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface FFTChartProps {
  data: any[]
  isLoading: boolean
}

// Simple FFT implementation using Cooley-Tukey algorithm
function computeFFT(signal: number[]): { frequency: number; magnitude: number }[] {
  const n = signal.length
  
  // Pad to nearest power of 2
  let paddedLength = 1
  while (paddedLength < n) {
    paddedLength *= 2
  }
  
  // Pad signal with zeros
  const paddedSignal = [...signal, ...Array(paddedLength - n).fill(0)]
  
  // Simple DFT (not optimal but works for reasonable sizes)
  const fftResult: { real: number; imag: number }[] = []
  
  for (let k = 0; k < paddedLength; k++) {
    let real = 0
    let imag = 0
    
    for (let n_idx = 0; n_idx < paddedLength; n_idx++) {
      const angle = (-2 * Math.PI * k * n_idx) / paddedLength
      real += paddedSignal[n_idx] * Math.cos(angle)
      imag += paddedSignal[n_idx] * Math.sin(angle)
    }
    
    fftResult.push({ real, imag })
  }
  
  // Convert to frequency magnitude
  const result: { frequency: number; magnitude: number }[] = []
  
  for (let i = 0; i < paddedLength / 2; i++) {
    const magnitude = Math.sqrt(
      fftResult[i].real ** 2 + fftResult[i].imag ** 2
    ) / paddedLength
    
    result.push({
      frequency: i,
      magnitude: magnitude
    })
  }
  
  return result
}

export function FFTChart({ data, isLoading }: FFTChartProps) {
  const fftData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Get last minute of Z acceleration data
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    
    const recentData = data.filter(
      (point) => point.timestamp >= oneMinuteAgo
    )
    
    if (recentData.length < 2) {
      console.log('Not enough data points for FFT:', recentData.length)
      return []
    }
    
    // Extract Z acceleration values
    const zValues = recentData.map(point => point.accel_z || 0)
    
    // Compute FFT
    const fftResult = computeFFT(zValues)
    
    // Take only first 50 frequency components for better visualization
    return fftResult.slice(0, 50).map(point => ({
      ...point,
      frequency: parseFloat(point.frequency.toFixed(1))
    }))
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm text-slate-600">
            Frequency Component: {data.frequency}
          </p>
          <p className="text-sm font-semibold text-pink-600">
            Magnitude: {data.magnitude?.toFixed(4) || 'N/A'} g
          </p>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-pink-600 rounded-full animate-pulse"></div>
          <span className="text-slate-600">Computing FFT...</span>
        </div>
      </div>
    )
  }

  if (fftData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 rounded-lg">
        <span className="text-slate-600">Insufficient data for FFT (need at least 2 samples from last minute)</span>
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={fftData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="frequency" 
            stroke="#64748b" 
            fontSize={10}
            label={{ value: "Frequency Component", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            label={{ value: "Magnitude (g)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="magnitude"
            stroke="#ec4899"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ec4899" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
