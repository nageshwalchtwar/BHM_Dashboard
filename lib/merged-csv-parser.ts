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
  console.log(`📊 Header count: ${headers.length}`)

  // Flexible column matching for the merged CSV format
  // Look for: timestamp, az with rms, temp with avg, lvdt with avg
  let tsIndex = headers.findIndex(h => h.includes('timestamp'));
  let azIndex = headers.findIndex(h => h.includes('az') && h.includes('rms')) || 
                  headers.findIndex(h => h.includes('accel') && h.includes('z'));
  let tempIndex = headers.findIndex(h => h.includes('temp') && h.includes('avg')) || 
                    headers.findIndex(h => h.includes('temperature'));
  let lvdtIndex = headers.findIndex(h => h.includes('lvdt') && h.includes('avg')) || 
                    headers.findIndex(h => h.includes('stroke'));

  // Fallback: Use positional matching if standard names not found
  // Expected order: timestamp, ax_rms, ay_rms, az_rms, temp_avg, lvdt_avg
  if (tsIndex === -1 && headers.length >= 6) {
    tsIndex = 0;
    console.log('📌 Using positional fallback for timestamp (position 0)')
  }
  if (azIndex === -1 && headers.length >= 6) {
    azIndex = 3; // Assuming: [timestamp, ax_rms, ay_rms, az_rms, temp, lvdt]
    console.log('📌 Using positional fallback for az_rms (position 3)')
  }
  if (tempIndex === -1 && headers.length >= 6) {
    tempIndex = 4;
    console.log('📌 Using positional fallback for temp_avg (position 4)')
  }
  if (lvdtIndex === -1 && headers.length >= 6) {
    lvdtIndex = 5;
    console.log('📌 Using positional fallback for lvdt_avg (position 5)')
  }

  console.log(`🔍 Column indices - timestamp:${tsIndex}, az_rms:${azIndex}, temp_avg:${tempIndex}, lvdt_avg:${lvdtIndex}`)
  console.log(`📋 Headers found:`, {
    timestamp: tsIndex >= 0 && tsIndex < headers.length ? headers[tsIndex] : 'NOT FOUND',
    az_rms: azIndex >= 0 && azIndex < headers.length ? headers[azIndex] : 'NOT FOUND',
    temp_avg: tempIndex >= 0 && tempIndex < headers.length ? headers[tempIndex] : 'NOT FOUND',
    lvdt_avg: lvdtIndex >= 0 && lvdtIndex < headers.length ? headers[lvdtIndex] : 'NOT FOUND',
  })

  if (azIndex === -1 || tempIndex === -1 || lvdtIndex === -1 || tsIndex === -1) {
    console.error('❌ Missing required columns in merged CSV', {
      hasTimestamp: tsIndex !== -1,
      hasAzRms: azIndex !== -1,
      hasTempAvg: tempIndex !== -1,
      hasLvdtAvg: lvdtIndex !== -1,
      providedHeaders: headers,
      availableColumns: headers.length,
    })
    console.error('💾 CSV Preview (first 500 chars):', csvContent.slice(0, 500))
    console.error('🔤 First 3 lines:')
    lines.slice(0, 3).forEach((line, i) => console.error(`   Line ${i}: ${line.substring(0, 100)}...`))
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
      // Try multiple date formats
      let ts = new Date(tsStr).getTime()
      
      // If standard parsing fails, try manual parsing for "2026-02-12 0:00:00" format
      if (isNaN(ts) && tsStr.includes(' ')) {
        const parts = tsStr.split(' ')
        if (parts[0] && parts[1]) {
          ts = new Date(`${parts[0]}T${parts[1]}`).getTime()
        }
      }
      
      if (isNaN(ts)) {
        if (rowsProcessed <= 5) {
          console.warn(`⚠️ Row ${i}: Invalid timestamp "${tsStr}"`)
        }
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
