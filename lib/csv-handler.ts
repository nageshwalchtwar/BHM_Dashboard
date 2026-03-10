/**
 * Downsample data to RMS values per window for each acceleration axis,
 * and mean for temperature/stroke.
 * @param data CSVSensorData[] (any sort order)
 * @param windowMs Window size in milliseconds (default 1000 = 1 second)
 * @returns CSVSensorData[] with 1 data point per window
 */
export function downsampleToRMSPerSecond(data: CSVSensorData[], windowMs: number = 1000): CSVSensorData[] {
  if (!data.length) return [];
  // Sort by timestamp ascending for windowing
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const result: CSVSensorData[] = [];

  let window: CSVSensorData[] = [];
  let windowStart = sorted[0].timestamp;

  const flushWindow = () => {
    if (window.length === 0) return;
    // RMS for ADXL accelerometer axes
    const ax_adxl_rms = calculateRMS(window.map(d => d.ax_adxl ?? 0));
    const ay_adxl_rms = calculateRMS(window.map(d => d.ay_adxl ?? 0));
    const az_adxl_rms = calculateRMS(window.map(d => d.az_adxl ?? 0));
    // RMS for WT901 accelerometer axes
    const ax_wt901_rms = calculateRMS(window.map(d => d.ax_wt901 ?? 0));
    const ay_wt901_rms = calculateRMS(window.map(d => d.ay_wt901 ?? 0));
    const az_wt901_rms = calculateRMS(window.map(d => d.az_wt901 ?? 0));
    const accel_x_rms = calculateRMS(window.map(d => d.accel_x ?? 0));
    const accel_y_rms = calculateRMS(window.map(d => d.accel_y ?? 0));
    const accel_z_rms = calculateRMS(window.map(d => d.accel_z ?? 0));
    // LVDT/stroke: 1-second average (mean)
    const stroke_avg = calculateMean(window.map(d => d.stroke_mm ?? 0));
    // Temperature: raw value (last sample in window, no averaging)
    const lastSample = window[window.length - 1];
    const temp_raw = lastSample.temperature_c ?? lastSample.temperature ?? 0;

    result.push({
      timestamp: windowStart,
      rawTimestamp: window[0].rawTimestamp,
      // ADXL: RMS
      ax_adxl: ax_adxl_rms,
      ay_adxl: ay_adxl_rms,
      az_adxl: az_adxl_rms,
      // WT901: RMS
      ax_wt901: ax_wt901_rms,
      ay_wt901: ay_wt901_rms,
      az_wt901: az_wt901_rms,
      // Generic accel: RMS
      accel_x: accel_x_rms,
      accel_y: accel_y_rms,
      accel_z: accel_z_rms,
      // Compatibility aliases
      x: accel_x_rms,
      y: accel_y_rms,
      z: accel_z_rms,
      vibration: accel_x_rms,
      acceleration: accel_y_rms,
      // LVDT: average
      stroke_mm: stroke_avg,
      strain: stroke_avg,
      // Temperature: raw (last sample)
      temperature_c: temp_raw,
      temperature: temp_raw,
      // Metadata
      id: window[0].id,
      created_at: window[0].created_at,
    } as CSVSensorData);
  };

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    if (point.timestamp - windowStart < windowMs) {
      window.push(point);
    } else {
      flushWindow();
      window = [point];
      windowStart = point.timestamp;
    }
  }
  // Final window
  flushWindow();

  return result;
}

function calculateMean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
// Calculate RMS for a numeric array
function calculateRMS(values: number[]): number {
  if (!values.length) return 0;
  const meanSquare = values.reduce((sum, v) => sum + v * v, 0) / values.length;
  return Math.sqrt(meanSquare);
}

/**
 * Streaming CSV → RMS parser.  Parses raw CSV text and computes RMS windows
 * in a **single pass** without creating an intermediate CSVSensorData[] array.
 * Memory: O(windowSize) instead of O(totalRows).
 *
 * @param csvText   Raw CSV string (may lack header when produced from Range-download tail)
 * @param windowMs  RMS window in ms (1000 = 1s)
 * @param fileDate  Optional date for time-only timestamps
 * @param header    Optional pre-known header row (if csv was from Range tail download)
 * @param tailSeconds  If > 0, only keep data from the last N seconds
 * @returns { rmsData, rawRowCount, latestRMS }
 */
export function streamParseCSVToRMS(
  csvText: string,
  windowMs: number = 1000,
  fileDate?: string,
  header?: string,
  tailSeconds?: number,
): {
  rmsData: CSVSensorData[];
  rawRowCount: number;
  latestRMS: { accel_x_rms: number; accel_y_rms: number; accel_z_rms: number; wt901_x_rms: number; wt901_y_rms: number; wt901_z_rms: number };
} {
  const lines = csvText.split('\n');
  const emptyRMS = { accel_x_rms: 0, accel_y_rms: 0, accel_z_rms: 0, wt901_x_rms: 0, wt901_y_rms: 0, wt901_z_rms: 0 };
  if (lines.length < 2) return { rmsData: [], rawRowCount: 0, latestRMS: emptyRMS };

  // Resolve header
  let headerLine: string;
  let dataStartIdx: number;
  if (header) {
    headerLine = header;
    dataStartIdx = 0; // All lines are data
  } else {
    headerLine = lines[0];
    dataStartIdx = 1;
  }

  const rawHeaders = headerLine.split(',').map(h => h.trim());
  const headers = rawHeaders.map(h => h.toLowerCase());

  // Column index lookup
  const col = (name: string): number => headers.indexOf(name);
  const tsIdx = Math.max(col('timestamp'), col('time'));
  const axAdxlIdx = col('ax_adxl'); const ayAdxlIdx = col('ay_adxl'); const azAdxlIdx = col('az_adxl');
  const axWt901Idx = col('ax_wt901'); const ayWt901Idx = col('ay_wt901'); const azWt901Idx = col('az_wt901');
  const accelXIdx = col('accel_x') >= 0 ? col('accel_x') : col('x');
  const accelYIdx = col('accel_y') >= 0 ? col('accel_y') : col('y');
  const accelZIdx = col('accel_z') >= 0 ? col('accel_z') : col('z');
  const strokeIdx = col('stroke_mm') >= 0 ? col('stroke_mm') : col('stroke_mm');
  const tempIdx = [col('temp_c'), col('temperature_c'), col('temperature')].find(i => i >= 0) ?? -1;

  const pf = (vals: string[], idx: number): number => {
    if (idx < 0 || idx >= vals.length) return 0;
    const v = vals[idx];
    if (!v || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  // Date reference for time-only timestamps
  const dateRef = fileDate ? new Date(fileDate) : new Date();

  function parseTimestamp(raw: string): number {
    const s = raw.trim();
    if (s.match(/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/)) {
      const [h, m, secPart] = s.split(':');
      const sec = parseFloat(secPart || '0');
      return Date.UTC(dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
        parseInt(h), parseInt(m), Math.floor(sec), Math.round((sec % 1) * 1000));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // ── First pass: fast-parse all rows into lightweight numeric arrays ──
  // We need to sort by timestamp, so collect {ts, values} tuples
  interface RowTuple { ts: number; raw: string; vals: string[] }
  const rows: RowTuple[] = [];

  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 5) continue;
    const vals = line.split(',');
    if (vals.length < headers.length - 1) continue; // allow off-by-one
    const ts = tsIdx >= 0 ? parseTimestamp(vals[tsIdx]) : 0;
    if (ts === 0) continue;
    rows.push({ ts, raw: vals[tsIdx]?.trim() || '', vals });
  }

  if (rows.length === 0) return { rmsData: [], rawRowCount: 0, latestRMS: emptyRMS };

  // Sort ascending by timestamp
  rows.sort((a, b) => a.ts - b.ts);

  // Optional: trim to last N seconds
  let startIdx = 0;
  if (tailSeconds && tailSeconds > 0) {
    const cutoff = rows[rows.length - 1].ts - tailSeconds * 1000;
    startIdx = rows.findIndex(r => r.ts >= cutoff);
    if (startIdx < 0) startIdx = 0;
  }

  // ── Second pass: window-based RMS aggregation ──
  const rmsData: CSVSensorData[] = [];

  // Running window accumulators
  let wStart = rows[startIdx].ts;
  let wAxAdxl: number[] = [], wAyAdxl: number[] = [], wAzAdxl: number[] = [];
  let wAxWt: number[] = [], wAyWt: number[] = [], wAzWt: number[] = [];
  let wAx: number[] = [], wAy: number[] = [], wAz: number[] = [];
  let wStroke: number[] = [], wTemp: number[] = [];
  let wFirstRaw = '';

  const flushWindow = () => {
    if (wAx.length === 0 && wAxAdxl.length === 0) return;
    const ax_adxl_rms = calculateRMS(wAxAdxl);
    const ay_adxl_rms = calculateRMS(wAyAdxl);
    const az_adxl_rms = calculateRMS(wAzAdxl);
    const ax_wt_rms = calculateRMS(wAxWt);
    const ay_wt_rms = calculateRMS(wAyWt);
    const az_wt_rms = calculateRMS(wAzWt);
    const ax_rms = calculateRMS(wAx);
    const ay_rms = calculateRMS(wAy);
    const az_rms = calculateRMS(wAz);
    const stroke_avg = wStroke.length ? calculateMean(wStroke) : 0;
    const temp_last = wTemp.length ? wTemp[wTemp.length - 1] : 0;

    rmsData.push({
      timestamp: wStart,
      rawTimestamp: wFirstRaw,
      ax_adxl: ax_adxl_rms, ay_adxl: ay_adxl_rms, az_adxl: az_adxl_rms,
      ax_wt901: ax_wt_rms, ay_wt901: ay_wt_rms, az_wt901: az_wt_rms,
      accel_x: ax_rms || ax_adxl_rms, accel_y: ay_rms || ay_adxl_rms, accel_z: az_rms || az_adxl_rms,
      x: ax_rms || ax_adxl_rms, y: ay_rms || ay_adxl_rms, z: az_rms || az_adxl_rms,
      vibration: ax_rms || ax_adxl_rms, acceleration: ay_rms || ay_adxl_rms,
      stroke_mm: stroke_avg, strain: stroke_avg,
      temperature_c: temp_last, temperature: temp_last,
    } as CSVSensorData);
  };

  for (let i = startIdx; i < rows.length; i++) {
    const { ts, raw, vals } = rows[i];
    if (ts - wStart >= windowMs) {
      flushWindow();
      // Reset accumulators
      wStart = ts; wFirstRaw = raw;
      wAxAdxl = []; wAyAdxl = []; wAzAdxl = [];
      wAxWt = []; wAyWt = []; wAzWt = [];
      wAx = []; wAy = []; wAz = [];
      wStroke = []; wTemp = [];
    }
    if (!wFirstRaw) wFirstRaw = raw;
    // Accumulate values
    wAxAdxl.push(pf(vals, axAdxlIdx));
    wAyAdxl.push(pf(vals, ayAdxlIdx));
    wAzAdxl.push(pf(vals, azAdxlIdx));
    wAxWt.push(pf(vals, axWt901Idx));
    wAyWt.push(pf(vals, ayWt901Idx));
    wAzWt.push(pf(vals, azWt901Idx));
    const axVal = pf(vals, accelXIdx) || pf(vals, axAdxlIdx);
    const ayVal = pf(vals, accelYIdx) || pf(vals, ayAdxlIdx);
    const azVal = pf(vals, accelZIdx) || pf(vals, azAdxlIdx);
    wAx.push(axVal); wAy.push(ayVal); wAz.push(azVal);
    wStroke.push(pf(vals, strokeIdx));
    wTemp.push(pf(vals, tempIdx));
  }
  flushWindow(); // Last window

  // Compute latest 1-second RMS from the last window or last second of rmsData
  const latestRMS = rmsData.length > 0 ? {
    accel_x_rms: rmsData[rmsData.length - 1].accel_x ?? 0,
    accel_y_rms: rmsData[rmsData.length - 1].accel_y ?? 0,
    accel_z_rms: rmsData[rmsData.length - 1].accel_z ?? 0,
    wt901_x_rms: rmsData[rmsData.length - 1].ax_wt901 ?? 0,
    wt901_y_rms: rmsData[rmsData.length - 1].ay_wt901 ?? 0,
    wt901_z_rms: rmsData[rmsData.length - 1].az_wt901 ?? 0,
  } : emptyRMS;

  return { rmsData, rawRowCount: rows.length - startIdx, latestRMS };
}

/**
 * Calculate RMS for accel_x, accel_y, accel_z over a 1-second window (most recent second)
 * @param data CSVSensorData[] (should be sorted by timestamp descending)
 * @param samplesPerSecond number (default 40)
 * @returns { accel_x_rms, accel_y_rms, accel_z_rms }
 */
export function getLatestRMSValues(
  data: CSVSensorData[],
  samplesPerSecond: number = 40
): {
  accel_x_rms: number;
  accel_y_rms: number;
  accel_z_rms: number;
  wt901_x_rms: number;
  wt901_y_rms: number;
  wt901_z_rms: number;
} {
  if (!data.length) return {
    accel_x_rms: 0, accel_y_rms: 0, accel_z_rms: 0,
    wt901_x_rms: 0, wt901_y_rms: 0, wt901_z_rms: 0
  };
  // Take the most recent 1 second of data
  const latestTimestamp = data[0].timestamp;
  const oneSecondAgo = latestTimestamp - 1000;
  const windowData = data.filter(d => d.timestamp >= oneSecondAgo);
  const accel_x = windowData.map(d => d.accel_x ?? 0);
  const accel_y = windowData.map(d => d.accel_y ?? 0);
  const accel_z = windowData.map(d => d.accel_z ?? 0);
  const wt901_x = windowData.map(d => d.ax_wt901 ?? 0);
  const wt901_y = windowData.map(d => d.ay_wt901 ?? 0);
  const wt901_z = windowData.map(d => d.az_wt901 ?? 0);

  return {
    accel_x_rms: calculateRMS(accel_x),
    accel_y_rms: calculateRMS(accel_y),
    accel_z_rms: calculateRMS(accel_z),
    wt901_x_rms: calculateRMS(wt901_x),
    wt901_y_rms: calculateRMS(wt901_y),
    wt901_z_rms: calculateRMS(wt901_z)
  };
}
import { SensorData } from './data-generator'
import { GoogleDriveCSVReader, EXTRACTED_FOLDER_ID } from './google-drive'

export interface CSVSensorData extends SensorData {
  id?: string
  created_at?: string
  rawTimestamp?: string  // Store the original timestamp string from CSV
  // Your specific CSV columns - support both old and new names
  x?: number
  y?: number
  z?: number
  accel_x?: number
  accel_y?: number
  accel_z?: number
  stroke_mm?: number
  temperature_c?: number
  // New WT901 accelerometer fields
  ax_wt901?: number
  ay_wt901?: number
  az_wt901?: number
  // New ADXL accelerometer fields
  ax_adxl?: number
  ay_adxl?: number
  az_adxl?: number
}

/**
 * Parse CSV content and convert to sensor data format
 * @param csvContent The raw CSV string
 * @param fileDate Optional date string (ISO) for the file — used to assign the correct date
 *                 to time-only timestamps like "12:30:45.123"
 */
export function parseCSVToSensorData(csvContent: string, fileDate?: string): CSVSensorData[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return [] // Need at least header + 1 data row

  // Keep original case for headers, but create lowercase lookup
  const originalHeaders = lines[0].split(',').map(h => h.trim())
  const headers = originalHeaders.map(h => h.toLowerCase())
  // console.log('🔍 CSV headers found:', originalHeaders)
  // console.log('🔍 Looking for columns: temperature_C, accel_x, accel_y, accel_z, stroke_mm, Timestamp (new format) or Temperature_C, X, Y, Z, Stroke_mm, Timestamp (old format)')

  const data: CSVSensorData[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) {
      // console.warn(`Row ${i} has ${values.length} columns but expected ${headers.length}`)
      continue
    }

    // Create both original case and lowercase lookup objects
    const row: any = {}
    const lowerRow: any = {}
    originalHeaders.forEach((header, index) => {
      row[header] = values[index]
      lowerRow[header.toLowerCase()] = values[index]
    })

    // Convert to standard sensor data format
    try {
      // Try to find timestamp column (case-insensitive)
      let timestamp: number = Date.now()
      let rawTimestamp = '' // Declare at the proper scope level

      // Use timestamp from CSV directly - handle different formats
      const timestampValue = row['Timestamp'] || row['timestamp'] || row['Time'] || row['time']

      if (timestampValue && timestampValue !== '') {
        // Store the raw timestamp string for display
        rawTimestamp = timestampValue.toString().trim()
        // For sorting and filtering, create a simple numeric timestamp
        // If it's time-only format like "01:29:07", combine with file date or today's date
        if (rawTimestamp.match(/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/)) {
          // Time-only format - use the file's date if available, else today
          // Use Date.UTC to store time values without server-timezone bias
          const dateRef = fileDate ? new Date(fileDate) : new Date()
          const [hours, minutes, secondsPart] = rawTimestamp.split(':')
          const seconds = parseFloat(secondsPart || '0')
          const timeDate = new Date(Date.UTC(
            dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
            parseInt(hours), parseInt(minutes), Math.floor(seconds),
            Math.round((seconds % 1) * 1000)))
          timestamp = timeDate.getTime()
        } else {
          // Try to parse as regular date/time
          const parsed = new Date(rawTimestamp)
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed.getTime()
          } else {
            // Fallback: use current time with incrementing milliseconds
            timestamp = Date.now() + (data.length * 1000)
          }
        }
      } else {
        // No timestamp found - use incremental time and generate raw timestamp
        timestamp = Date.now() + (data.length * 1000)
        rawTimestamp = new Date(timestamp).toLocaleTimeString()
      }

      // Parse values with exact column name matching first, then fallback to lowercase
      const parseValue = (exactName: string, fallbackName?: string): number => {
        let val = row[exactName] || (fallbackName ? lowerRow[fallbackName] : lowerRow[exactName.toLowerCase()])

        // Special handling for temperature - try multiple variations including new Temp_C format
        if ((exactName === 'Temp_C' || exactName === 'Temperature_C' || fallbackName === 'temperature_c') && !val) {
          val = row['Temp_C'] || row['temperature_c'] || row['Temperature_C'] || row['Temperature_c'] || row['TEMPERATURE_C'] ||
            lowerRow['temperature'] || lowerRow['temp'] || lowerRow['temperature_c']
        }

        // Debug Temperature_C specifically
        if (exactName === 'Temperature_C' || fallbackName === 'temperature_c') {
          // console.log(`🌡️ Temperature_C parsing:`, {
          //   exactName,
          //   fallbackName,
          //   exactValue: row[exactName],
          //   fallbackValue: fallbackName ? lowerRow[fallbackName] : undefined,
          //   alternateValues: {
          //     'temperature_c': row['temperature_c'],
          //     'Temperature_c': row['Temperature_c'], 
          //     'TEMPERATURE_C': row['TEMPERATURE_C'],
          //     'temperature': lowerRow['temperature'],
          //     'temp': lowerRow['temp']
          //   },
          //   finalValue: val,
          //   allRowKeys: Object.keys(row),
          //   allValues: row
          // })
        }

        if (val !== undefined && val !== null && val !== '') {
          const parsed = parseFloat(val)
          if (!isNaN(parsed)) return parsed
        }
        return 0
      }

      const sensorData: CSVSensorData = {
        timestamp,
        rawTimestamp, // Add the rawTimestamp field here
        // ADXL accelerometer data (primary for general use)
        accel_x: parseValue('ax_adxl') || parseValue('accel_x') || parseValue('X', 'x'),
        accel_y: parseValue('ay_adxl') || parseValue('accel_y') || parseValue('Y', 'y'),
        accel_z: parseValue('az_adxl') || parseValue('accel_z') || parseValue('Z', 'z'),
        // Separate ADXL fields
        ax_adxl: parseValue('ax_adxl'),
        ay_adxl: parseValue('ay_adxl'),
        az_adxl: parseValue('az_adxl'),
        // Separate WT901 fields
        ax_wt901: parseValue('ax_wt901'),
        ay_wt901: parseValue('ay_wt901'),
        az_wt901: parseValue('az_wt901'),
        // Other sensor data
        stroke_mm: parseValue('stroke_mm') || parseValue('Stroke_mm', 'stroke_mm'),
        temperature_c: parseValue('Temp_C') || parseValue('temperature_C') || parseValue('Temperature_C', 'temperature_c'),
        // Keep old field names for backward compatibility
        x: parseValue('ax_adxl') || parseValue('accel_x') || parseValue('X', 'x'),
        y: parseValue('ay_adxl') || parseValue('accel_y') || parseValue('Y', 'y'),
        z: parseValue('az_adxl') || parseValue('accel_z') || parseValue('Z', 'z'),
        // Keep legacy fields for backward compatibility
        vibration: parseValue('ax_adxl') || parseValue('accel_x') || parseValue('X', 'x'), // Use ax_adxl for vibration chart
        acceleration: parseValue('ay_adxl') || parseValue('accel_y') || parseValue('Y', 'y'), // Use ay_adxl for acceleration chart  
        strain: parseValue('stroke_mm') || parseValue('Stroke_mm', 'stroke_mm'), // Use stroke for strain chart
        temperature: parseValue('Temp_C') || parseValue('temperature_C') || parseValue('Temperature_C', 'temperature_c'), // Use Temp_C for temperature chart
        id: `${i}`, // Use row number as ID instead of device column
        created_at: lowerRow['created_at'] || new Date(timestamp).toISOString()
      }

      // Always add data points - even if some values are zero, they're still valid measurements
      data.push(sensorData)

      // Log first few data points for debugging
      if (data.length <= 3) {
        // console.log(`Sample data point ${data.length}:`, {
        //   rawTimestamp: sensorData.rawTimestamp,
        //   parsedTimestamp: new Date(sensorData.timestamp).toLocaleString(),
        //   // Show both old and new field names for debugging
        //   accel_x: sensorData.accel_x || sensorData.x,
        //   accel_y: sensorData.accel_y || sensorData.y,
        //   accel_z: sensorData.accel_z || sensorData.z,
        //   // Check if we're using new column names from CSV
        //   rawAccelX: row['accel_x'],
        //   rawAccelY: row['accel_y'], 
        //   rawAccelZ: row['accel_z'],
        //   rawTempC: row['temperature_C'],
        //   rawStroke: row['stroke_mm'],
        //   temperature_c: sensorData.temperature_c,
        //   stroke_mm: sensorData.stroke_mm,
        //   originalHeaders: originalHeaders
        // })
      }
    } catch (error) {
      // console.warn('Error parsing row:', i, error)
    }
  }

  // console.log(`Successfully parsed ${data.length} valid data points from ${lines.length - 1} rows`)
  return data
}

/**
 * Ensure data covers the requested time window by extending with synthetic data if needed
 */
function ensureTimeWindow(data: CSVSensorData[], requestedMinutes: number): CSVSensorData[] {
  if (data.length === 0) {
    console.log(`⚠️ No data available, generating ${requestedMinutes} minute(s) of synthetic data`)
    return generateSyntheticTimeSeriesData(requestedMinutes)
  }

  // Sort by timestamp (newest first)
  const sortedData = [...data].sort((a, b) => b.timestamp - a.timestamp)
  const latestTimestamp = sortedData[0].timestamp
  const oldestTimestamp = sortedData[sortedData.length - 1].timestamp
  const actualTimeSpan = (latestTimestamp - oldestTimestamp) / 1000 / 60 // minutes

  console.log(`🕐 Real data time span: ${actualTimeSpan.toFixed(1)} minutes (requested: ${requestedMinutes} minutes)`)

  // If we have less than 80% of requested time coverage, extend with synthetic data
  if (actualTimeSpan < requestedMinutes * 0.8) {
    console.log(`⚠️ Insufficient time coverage (${actualTimeSpan.toFixed(1)}min < ${requestedMinutes}min), extending with synthetic data`)

    const targetTimeSpan = requestedMinutes * 60 * 1000 // milliseconds
    const neededStartTime = latestTimestamp - targetTimeSpan

    // Generate synthetic data to fill the time gap
    const syntheticData = generateSyntheticTimeSeriesData(requestedMinutes, neededStartTime, latestTimestamp)

    // Merge real and synthetic data, prioritizing real data
    const mergedData = [...sortedData]

    for (const synthPoint of syntheticData) {
      // Only add synthetic data if no real data exists within 1 second
      const hasRealDataNearby = sortedData.some(realPoint =>
        Math.abs(realPoint.timestamp - synthPoint.timestamp) < 1000
      )
      if (!hasRealDataNearby) {
        mergedData.push(synthPoint)
      }
    }

    // Sort the merged data
    const finalData = mergedData.sort((a, b) => b.timestamp - a.timestamp)
    console.log(`✅ Extended data: ${data.length} real + ${finalData.length - data.length} synthetic = ${finalData.length} total points`)

    return finalData
  }

  return data
}

/**
 * Generate synthetic time series data for testing/fallback
 */
function generateSyntheticTimeSeriesData(minutes: number, startTime?: number, endTime?: number): CSVSensorData[] {
  const data: CSVSensorData[] = []
  const samplesPerSecond = 100 // Match original sample rate
  const totalSamples = minutes * 60 * samplesPerSecond

  const now = endTime || Date.now()
  const timeSpan = minutes * 60 * 1000
  const interval = timeSpan / totalSamples

  console.log(`🎯 Generating ${totalSamples} synthetic data points over ${minutes} minute(s)`)

  for (let i = 0; i < totalSamples; i++) {
    const timestamp = now - (i * interval)
    const time = timestamp / 1000 // for wave calculations

    // Generate realistic sensor values with some variation
    const baseStroke = 84.5 + Math.sin(time * 0.001) * 0.5 + (Math.random() - 0.5) * 0.1
    const baseTemp = 21.5 + Math.sin(time * 0.0005) * 0.3 + (Math.random() - 0.5) * 0.1
    const baseAccelX = Math.sin(time * 0.002) * 0.2 + (Math.random() - 0.5) * 0.05
    const baseAccelY = Math.cos(time * 0.0015) * 0.15 + (Math.random() - 0.5) * 0.04
    const baseAccelZ = 1.0 + Math.sin(time * 0.0008) * 0.1 + (Math.random() - 0.5) * 0.02

    data.push({
      timestamp,
      rawTimestamp: new Date(timestamp).toLocaleTimeString(),
      stroke_mm: baseStroke,
      temperature_c: baseTemp,
      accel_x: baseAccelX,
      accel_y: baseAccelY,
      accel_z: baseAccelZ,
      // ADXL data (same as main accel for now)
      ax_adxl: baseAccelX,
      ay_adxl: baseAccelY,
      az_adxl: baseAccelZ,
      // WT901 data (slightly different)
      ax_wt901: baseAccelX * 1.1,
      ay_wt901: baseAccelY * 1.1,
      az_wt901: baseAccelZ * 1.05,
      // Legacy fields
      x: baseAccelX,
      y: baseAccelY,
      z: baseAccelZ,
      vibration: baseAccelX,
      acceleration: baseAccelY,
      strain: baseStroke,
      temperature: baseTemp,
      id: `synthetic_${i}`,
      created_at: new Date(timestamp).toISOString()
    })
  }

  return data.sort((a, b) => b.timestamp - a.timestamp)
}
function applySampleRateFilter(data: CSVSensorData[], minutes: number, customSamplesPerSecond?: number): CSVSensorData[] {
  if (data.length === 0) return []

  // Determine target samples per second
  let targetSamplesPerSecond: number

  if (customSamplesPerSecond) {
    targetSamplesPerSecond = customSamplesPerSecond
    console.log(`📊 Using custom sample rate: ${targetSamplesPerSecond} samples/sec`)
  } else {
    // Default rates based on time window
    if (minutes <= 1) {
      targetSamplesPerSecond = 40 // 1 minute view: 40 samples/sec (2400 samples total)
    } else {
      targetSamplesPerSecond = 30 // 5+ minute view: 30 samples/sec
    }
    console.log(`📊 Using default sample rate: ${targetSamplesPerSecond} samples/sec for ${minutes}min view`)
  }

  // Original sample rate is ~100 samples/second
  const originalSamplesPerSecond = 100
  const skipRatio = originalSamplesPerSecond / targetSamplesPerSecond

  console.log(`📊 Applying sample rate filter: ${targetSamplesPerSecond} samples/sec (skip ratio: ${skipRatio.toFixed(2)}) for ${minutes}min view`)
  console.log(`📊 Input data: ${data.length} points`)

  // Sort by timestamp (oldest first) for proper sampling
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp)

  const sampledData: CSVSensorData[] = []

  // Use time-based sampling instead of simple index-based sampling
  if (data.length === 0) return sampledData

  // Calculate time interval between samples based on target rate
  const timeWindow = sortedData.length > 1 ? (sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp) : 0
  const totalSeconds = timeWindow / 1000
  const targetInterval = 1000 / targetSamplesPerSecond // milliseconds between samples

  console.log(`📊 Time analysis: First=${new Date(sortedData[0].timestamp).toLocaleTimeString()}, Last=${new Date(sortedData[sortedData.length - 1].timestamp).toLocaleTimeString()}`)
  console.log(`📊 Time window: ${totalSeconds.toFixed(1)}s, Target interval: ${targetInterval}ms`)

  let lastSampleTime = 0

  for (let i = 0; i < sortedData.length; i++) {
    const currentTime = sortedData[i].timestamp

    // Take first sample, last sample, or if enough time has passed since last sample
    if (i === 0 || i === sortedData.length - 1 || (currentTime - lastSampleTime) >= targetInterval) {
      sampledData.push(sortedData[i])
      lastSampleTime = currentTime
    }
  }

  // If we don't have enough samples, use index-based sampling as fallback
  if (sampledData.length < (targetSamplesPerSecond * totalSeconds * 0.8)) {
    console.log(`⚠️ Time-based sampling gave only ${sampledData.length} samples, using index-based fallback`)
    sampledData.length = 0 // Clear array

    const skipRatio = originalSamplesPerSecond / targetSamplesPerSecond
    for (let i = 0; i < sortedData.length; i += Math.max(1, Math.floor(skipRatio))) {
      sampledData.push(sortedData[i])
    }
  }

  // Sort back to newest first for consistency with other functions
  const finalData = sampledData.sort((a, b) => b.timestamp - a.timestamp)

  console.log(`✅ Sample filtering complete: ${data.length} → ${finalData.length} points (${minutes}min view, ${targetSamplesPerSecond}sps)`)

  return finalData
}

/**
 * Filter data to get only the most recent N minutes with optional sample rate filtering
 */
export function getRecentData(data: CSVSensorData[], minutes: number = 1, samplesPerSecond?: string | null, startDate?: string, endDate?: string): CSVSensorData[] {
  if (data.length === 0) {
    console.log(`⚠️ No input data, generating ${minutes} minute(s) of synthetic data`)
    const syntheticData = generateSyntheticTimeSeriesData(minutes)

    if (!samplesPerSecond || samplesPerSecond === 'raw') {
      return syntheticData // Return all synthetic data
    } else {
      return applySampleRateFilter(syntheticData, minutes, parseInt(samplesPerSecond))
    }
  }

  console.log(`🕐 Filtering data for last ${minutes} minute(s) from ${data.length} total points (sampling: ${samplesPerSecond || 'raw'})`)

  // Ensure we have enough time coverage first, unless explicit date ranges are passed.
  const isDateRange = !!(startDate && endDate);
  const timeExtendedData = isDateRange ? data : ensureTimeWindow(data, minutes)

  // Sort by timestamp descending (most recent first)
  const sortedData = timeExtendedData.sort((a, b) => b.timestamp - a.timestamp)

  if (sortedData.length === 0) return []

  let filteredData = sortedData;
  if (isDateRange) {
    const startTimestamp = new Date(startDate as string);
    startTimestamp.setHours(0, 0, 0, 0); // Start of the day
    const endTimestamp = new Date(endDate as string);
    endTimestamp.setHours(23, 59, 59, 999); // End of the day

    const startMs = startTimestamp.getTime();
    const endMs = endTimestamp.getTime();

    if (!isNaN(startMs) && !isNaN(endMs)) {
      console.log(`🕐 Filtering data strictly from ${new Date(startMs).toLocaleString()} to ${new Date(endMs).toLocaleString()}`);
      filteredData = sortedData.filter(item => item.timestamp >= startMs && item.timestamp <= endMs);
    }
  } else {
    // Get the most recent timestamp
    const latestTimestamp = sortedData[0].timestamp
    const oldestTimestamp = sortedData[sortedData.length - 1].timestamp
    console.log(`🕐 Data time range: ${new Date(oldestTimestamp).toLocaleTimeString()} to ${new Date(latestTimestamp).toLocaleTimeString()}`)

    // Calculate cutoff time (minutes ago from the latest data point)
    const cutoffTime = latestTimestamp - (minutes * 60 * 1000) // Convert minutes to milliseconds
    console.log(`🕐 Cutoff time: ${new Date(cutoffTime).toLocaleTimeString()} (${minutes} min ago from latest)`)

    // Filter data within the time window
    filteredData = sortedData.filter(item => item.timestamp >= cutoffTime)
  }

  if (filteredData.length > 0) {
    const filteredOldest = filteredData[filteredData.length - 1].timestamp
    const filteredNewest = filteredData[0].timestamp
    console.log(`🕐 After time filter: ${filteredData.length} points from ${new Date(filteredOldest).toLocaleTimeString()} to ${new Date(filteredNewest).toLocaleTimeString()}`)
  } else {
    console.log(`⚠️ No data points found within ${minutes} minute(s) window!`)
  }

  // Apply sample rate filtering based on time window and user selection
  let sampledData: CSVSensorData[]

  if (!samplesPerSecond || samplesPerSecond === 'raw') {
    console.log(`🎯 Returning RAW data: ${filteredData.length} points (no sampling)`)
    sampledData = filteredData
  } else {
    const targetSps = parseInt(samplesPerSecond)
    console.log(`📊 Applying custom sample rate: ${targetSps} samples/sec`)
    sampledData = applySampleRateFilter(filteredData, minutes, targetSps)
  }

  console.log(`✅ Final result: ${data.length} total → ${sampledData.length} filtered points for last ${minutes} minute(s)`)

  if (sampledData.length > 0) {
    const finalOldest = sampledData[sampledData.length - 1].timestamp
    const finalNewest = sampledData[0].timestamp
    const finalTimeSpan = (finalNewest - finalOldest) / 1000
    console.log(`🕐 Final time range: ${new Date(finalOldest).toLocaleTimeString()} to ${new Date(finalNewest).toLocaleTimeString()} (${finalTimeSpan.toFixed(1)}s)`)
  }

  return sampledData
}

/**
 * Get the latest file from a list of files based on modification time or filename
 */
export function getLatestFile(files: { name: string, lastModified?: number, content?: string }[]): { name: string, lastModified?: number, content?: string } | null {
  if (files.length === 0) return null

  // Sort by lastModified time if available, otherwise by filename (assuming timestamp in name)
  const sortedFiles = files.sort((a, b) => {
    if (a.lastModified && b.lastModified) {
      return b.lastModified - a.lastModified
    }
    // If no modification time, sort by filename (assuming newer files have later timestamps)
    return b.name.localeCompare(a.name)
  })

  return sortedFiles[0]
}

/**
 * Fetch the latest CSV data from Google Drive (or fallback to mock data)
 */
export async function fetchLatestCSVData(): Promise<CSVSensorData[]> {
  try {
    // Always try to use Google Drive API first (with the extracted folder ID)
    const driveReader = new GoogleDriveCSVReader({
      folderId: EXTRACTED_FOLDER_ID,
      apiKey: process.env.GOOGLE_DRIVE_API_KEY,
      accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN
    })

    // console.log('Attempting to fetch from Google Drive folder:', EXTRACTED_FOLDER_ID)

    // If no API key or access token, try direct public access first
    if (!process.env.GOOGLE_DRIVE_API_KEY && !process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
      // console.log('No API credentials found, trying direct public access...')
      const directContent = await driveReader.tryDirectPublicAccess()
      if (directContent) {
        const parsedData = parseCSVToSensorData(directContent)
        return getRecentData(parsedData, 1)
      }
    }

    // Try to list files from the API
    const files = await driveReader.listCSVFiles()
    // console.log(`Found ${files.length} CSV files in Google Drive`)

    if (files.length > 0) {
      const latestFile = files[0] // Already sorted by modifiedTime desc
      // console.log('Latest file details:', {
      // console.log('Latest file details:', {
      //   name: latestFile.name,
      //   modified: latestFile.modifiedTime,
      //   size: latestFile.size,
      //   id: latestFile.id
      // })

      const csvContent = await driveReader.readFileContent(latestFile.id)
      // console.log('CSV content preview:', csvContent.substring(0, 200) + '...')
      // console.log('CSV content length:', csvContent.length, 'characters')

      if (csvContent && csvContent.trim()) {
        const parsedData = parseCSVToSensorData(csvContent)
        // console.log('Parsed', parsedData.length, 'data points from CSV')

        const recentData = getRecentData(parsedData, 1) // Get last 1 minute of data
        // console.log('Filtered to', recentData.length, 'recent data points')

        if (recentData.length > 0) {
          // console.log('Successfully returning real CSV data!')
          return recentData
        } else {
          // console.log('No recent data found in CSV, using mock data')
        }
      }
    } else {
      // console.log('No CSV files found in the Google Drive folder')
    }

    // If no files or empty content, fall back to mock data
    // console.log('No valid CSV data found, using mock data for demo')
    const mockCSVContent = generateMockCSVContent()
    const parsedData = parseCSVToSensorData(mockCSVContent)
    return getRecentData(parsedData, 1)

  } catch (error) {
    // console.error('Error fetching CSV data from Google Drive:', error)
    // console.log('Error details:', error instanceof Error ? error.message : error)

    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      // console.log('🔑 Google Drive API key is required to access your CSV files')
      // console.log('📁 Your folder ID:', EXTRACTED_FOLDER_ID)
      // console.log('🌐 Folder URL: https://drive.google.com/drive/folders/10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM')
      // console.log('⚙️  Setup: Get API key from Google Cloud Console → Add to Vercel environment variables')
    }

    // Fallback to mock data on error
    // console.log('Falling back to mock data due to error')
    const mockCSVContent = generateMockCSVContent()
    const parsedData = parseCSVToSensorData(mockCSVContent)
    return getRecentData(parsedData, 1)
  }
}

/**
 * Generate mock CSV content for testing
 */
function generateMockCSVContent(): string {
  const now = new Date()
  const headers = 'created_at,entry_id,field1,field2,field3,field4'
  const rows = []

  // Generate data for the last 5 minutes, with data points every 10 seconds
  for (let i = 0; i < 30; i++) {
    const timestamp = new Date(now.getTime() - (i * 10 * 1000))
    const vibration = (1.2 + Math.sin(i * 0.1) * 0.3 + (Math.random() - 0.5) * 0.2).toFixed(3)
    const acceleration = (0.25 + Math.sin(i * 0.15) * 0.1 + (Math.random() - 0.5) * 0.1).toFixed(3)
    const strain = (120 + Math.sin(i * 0.08) * 20 + (Math.random() - 0.5) * 10).toFixed(1)
    const temperature = (22 + Math.sin(i * 0.05) * 5 + (Math.random() - 0.5) * 3).toFixed(1)

    rows.push(`${timestamp.toISOString()},${30 - i},${vibration},${acceleration},${strain},${temperature}`)
  }

  return headers + '\n' + rows.join('\n')
}