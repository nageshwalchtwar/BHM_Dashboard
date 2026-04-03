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
  if (lines.length === 0) {
    console.error('❌ CSV is empty')
    return []
  }

  // Parse header - detect delimiter (tab or comma)
  const headerLine = lines[0]
  const delimiter = headerLine.includes('\t') ? '\t' : ','
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase())

  console.log('📋 Merged CSV Headers:', headers)
  console.log(`📝 Using delimiter: '${delimiter === '\t' ? 'TAB' : 'COMMA'}'`)
  console.log(`📊 Total lines in CSV: ${lines.length}`)

  // Exact column matching for the merged CSV format
  const tsIndex = headers.indexOf('timestamp')
  const azIndex = headers.indexOf('az_adxl_rms')
  const tempIndex = headers.indexOf('temp_avg_10s')
  const lvdtIndex = headers.indexOf('lvdt_avg_10s')

  console.log(`🔍 Column indices - timestamp:${tsIndex}, az_adxl_rms:${azIndex}, temp_avg_10s:${tempIndex}, lvdt_avg_10s:${lvdtIndex}`)

  if (azIndex === -1 || tempIndex === -1 || lvdtIndex === -1 || tsIndex === -1) {
    console.error('❌ Missing required columns in merged CSV', {
      hasTimestamp: tsIndex !== -1,
      hasAzAdxlRms: azIndex !== -1,
      hasTempAvg10s: tempIndex !== -1,
      hasLvdtAvg10s: lvdtIndex !== -1,
      providedHeaders: headers,
    })
    console.error('💾 CSV Preview (first 800 chars):', csvContent.slice(0, 800))
    return []
  }

  const result: MergedDayData[] = []
  let parseErrors = 0

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(delimiter)
    if (cols.length <= Math.max(azIndex, tempIndex, lvdtIndex, tsIndex)) {
      console.warn(`⚠️ Row ${i} has insufficient columns: ${cols.length} (expected at least ${Math.max(azIndex, tempIndex, lvdtIndex, tsIndex) + 1})`)
      parseErrors++
      continue
    }

    try {
      const tsStr = cols[tsIndex].trim()
      // Parse datetime: "2026-02-12 0:00:00" or "2026-02-12 00:00:00"
      const ts = new Date(tsStr).getTime()
      if (isNaN(ts)) {
        console.warn(`⚠️ Invalid timestamp at row ${i}: "${tsStr}"`)
        parseErrors++
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
        console.warn(`⚠️ Row ${i} has NaN values:`, { 
          raw: [cols[azIndex], cols[tempIndex], cols[lvdtIndex]],
          parsed: { az, temp, lvdt } 
        })
        parseErrors++
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse row ${i}:`, e)
      parseErrors++
    }
  }

  console.log(`✅ Parsed ${result.length} valid rows from merged CSV (${parseErrors} errors)`)
  if (result.length === 0 && parseErrors > 0) {
    console.error('💥 All rows failed to parse! Check data format.')
  }
  return result
}
