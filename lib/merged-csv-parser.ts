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
  let delimiter = headerLine.includes('\t') ? '\t' : ','
  
  // Try comma first, if it has fewer columns, try tab
  let headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase())
  console.log(`📝 Initial delimiter detection: '${delimiter === '\t' ? 'TAB' : 'COMMA'}' → ${headers.length} columns`)
  
  // If very few columns detected with comma, try tab
  if (headers.length < 4 && !headerLine.includes('\t')) {
    delimiter = '\t'
    headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase())
    console.log(`🔄 Switched to TAB delimiter → ${headers.length} columns`)
  }

  console.log('📋 Merged CSV Headers:', headers)
  console.log(`📝 Using delimiter: '${delimiter === '\t' ? 'TAB' : 'COMMA'}'`)
  console.log(`📊 Total lines in CSV: ${lines.length}`)

  // Exact column matching for the merged CSV format
  // Pattern: timestamp, ax_adxl_rms, ay_adxl_rms, az_adxl_rms, temp_avg_10s, lvdt_avg_10s
  const tsIndex = headers.findIndex(h => h.includes('timestamp'));
  const azIndex = headers.findIndex(h => h.includes('az') && h.includes('rms'));
  const tempIndex = headers.findIndex(h => h.includes('temp') && h.includes('avg'));
  const lvdtIndex = headers.findIndex(h => h.includes('lvdt') && h.includes('avg'));

  console.log(`🔍 Column indices - timestamp:${tsIndex}, az_rms:${azIndex}, temp_avg:${tempIndex}, lvdt_avg:${lvdtIndex}`)

  if (azIndex === -1 || tempIndex === -1 || lvdtIndex === -1 || tsIndex === -1) {
    console.error('❌ Missing required columns in merged CSV', {
      hasTimestamp: tsIndex !== -1,
      hasAzRms: azIndex !== -1,
      hasTempAvg: tempIndex !== -1,
      hasLvdtAvg: lvdtIndex !== -1,
      providedHeaders: headers,
    })
    console.error('💾 CSV Preview (first 1000 chars):', csvContent.slice(0, 1000))
    console.error('🔤 First line:', headerLine)
    return []
  }

  const result: MergedDayData[] = []
  let parseErrors = 0
  let rowsProcessed = 0

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    rowsProcessed++
    const cols = line.split(delimiter)
    if (cols.length <= Math.max(azIndex, tempIndex, lvdtIndex, tsIndex)) {
      console.warn(`⚠️ Row ${i} has insufficient columns: ${cols.length} (expected at least ${Math.max(azIndex, tempIndex, lvdtIndex, tsIndex) + 1})`)
      parseErrors++
      continue
    }

    try {
      const tsStr = cols[tsIndex].trim()
      // Parse datetime: "2026-02-12 0:00:00", "2026-02-12 00:00:00", or ISO format
      const ts = new Date(tsStr).getTime()
      if (isNaN(ts)) {
        console.warn(`⚠️ Row ${i}: Invalid timestamp "${tsStr}"`)
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
        if (rowsProcessed <= 3) { // Log first 3 errors only
          console.warn(`⚠️ Row ${i} has NaN values:`, { 
            raw: [cols[azIndex], cols[tempIndex], cols[lvdtIndex]],
            parsed: { az, temp, lvdt } 
          })
        }
        parseErrors++
      }
    } catch (e) {
      if (rowsProcessed <= 3) {
        console.warn(`⚠️ Failed to parse row ${i}:`, e)
      }
      parseErrors++
    }
  }

  console.log(`✅ Parsed ${result.length} valid rows from ${rowsProcessed} data rows (${parseErrors} errors)`)
  if (result.length === 0 && parseErrors > 0) {
    console.error('💥 All rows failed to parse! Check CSV format.')
  }
  return result
}
