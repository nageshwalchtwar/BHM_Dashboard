/**
 * Parse merged 1-day CSV format with pre-computed RMS and averages
 * Expected columns: timestamp, ax_adxl_rms, ay_adxl_rms, az_adxl_rms, temp_avg_10s, lvdt_avg_10s
 */

export interface MergedDayData {
  timestamp: number
  accel_z: number  // az_adxl_rms (already RMS'd)
  temperature_c: number  // temp_avg_10s
  stroke_mm: number  // lvdt_avg_10s
}

export function parseMergedDayCSV(csvContent: string): MergedDayData[] {
  const lines = csvContent.split('\n').filter((line) => line.trim())
  if (lines.length === 0) return []

  // Parse header
  const headerLine = lines[0]
  const headers = headerLine.split('\t').map((h) => h.trim().toLowerCase())

  const azIndex = headers.findIndex((h) => h.includes('az_adxl_rms'))
  const tempIndex = headers.findIndex((h) => h.includes('temp_avg'))
  const lvdtIndex = headers.findIndex((h) => h.includes('lvdt_avg'))
  const tsIndex = headers.findIndex((h) => h.includes('timestamp'))

  if (azIndex === -1 || tempIndex === -1 || lvdtIndex === -1 || tsIndex === -1) {
    console.error('Missing required columns in merged CSV', {
      hasAz: azIndex !== -1,
      hasTemp: tempIndex !== -1,
      hasLvdt: lvdtIndex !== -1,
      hasTimestamp: tsIndex !== -1,
      headers,
    })
    return []
  }

  const result: MergedDayData[] = []

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split('\t')
    if (cols.length <= Math.max(azIndex, tempIndex, lvdtIndex, tsIndex)) continue

    try {
      const tsStr = cols[tsIndex].trim()
      // Parse ISO datetime: "2026-02-27 16:19:40"
      const ts = new Date(tsStr).getTime()
      if (isNaN(ts)) continue

      const az = parseFloat(cols[azIndex])
      const temp = parseFloat(cols[tempIndex])
      const lvdt = parseFloat(cols[lvdtIndex])

      if (!isNaN(az) && !isNaN(temp) && !isNaN(lvdt)) {
        result.push({
          timestamp: ts,
          accel_z: az,
          temperature_c: temp,
          stroke_mm: lvdt,
        })
      }
    } catch (e) {
      // Skip malformed rows
      console.warn(`Failed to parse row ${i}:`, e)
    }
  }

  return result
}
