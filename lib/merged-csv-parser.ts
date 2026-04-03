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

  // Parse header - detect delimiter (tab or comma)
  const headerLine = lines[0]
  const delimiter = headerLine.includes('\t') ? '\t' : ','
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase())

  console.log('📋 Merged CSV Headers:', headers)
  console.log(`📝 Using delimiter: '${delimiter === '\t' ? 'TAB' : 'COMMA'}'`)

  // Flexible column detection - try multiple patterns
  let azIndex = headers.findIndex((h) => 
    (h.includes('az') && (h.includes('adxl') || h.includes('rms'))) ||
    h === 'az_adxl_rms'
  )
  let tempIndex = headers.findIndex((h) => 
    h.includes('temp') || 
    h.includes('temperature') ||
    h === 'temp_avg_10s'
  )
  let lvdtIndex = headers.findIndex((h) => 
    h.includes('lvdt') || 
    h.includes('stroke') || 
    h.includes('displacement') ||
    h === 'lvdt_avg_10s'
  )
  let tsIndex = headers.findIndex((h) => 
    h.includes('timestamp') || h.includes('time') || h.includes('date')
  )

  console.log(`🔍 Column indices - timestamp:${tsIndex}, az:${azIndex}, temp:${tempIndex}, lvdt:${lvdtIndex}`)

  if (azIndex === -1 || tempIndex === -1 || lvdtIndex === -1 || tsIndex === -1) {
    console.error('❌ Missing required columns in merged CSV', {
      hasAz: azIndex !== -1,
      hasTemp: tempIndex !== -1,
      hasLvdt: lvdtIndex !== -1,
      hasTimestamp: tsIndex !== -1,
      headers,
    })
    console.error('📋 Full headers:', headers)
    console.error('💾 CSV Preview:', csvContent.slice(0, 500))
    return []
  }

  const result: MergedDayData[] = []

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(delimiter)
    if (cols.length <= Math.max(azIndex, tempIndex, lvdtIndex, tsIndex)) {
      console.warn(`⚠️ Row ${i} has insufficient columns: ${cols.length}`)
      continue
    }

    try {
      const tsStr = cols[tsIndex].trim()
      // Parse ISO datetime: "2026-02-27 16:19:40"
      const ts = new Date(tsStr).getTime()
      if (isNaN(ts)) {
        console.warn(`⚠️ Invalid timestamp at row ${i}: "${tsStr}"`)
        continue
      }

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
      } else {
        console.warn(`⚠️ Row ${i} has NaN values:`, { az, temp, lvdt })
      }
    } catch (e) {
      // Skip malformed rows
      console.warn(`⚠️ Failed to parse row ${i}:`, e)
    }
  }

  console.log(`✅ Parsed ${result.length} valid rows from merged CSV`)
  return result
}
