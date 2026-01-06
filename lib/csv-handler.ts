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
 */
export function parseCSVToSensorData(csvContent: string): CSVSensorData[] {
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
      let timestamp = Date.now()
      let rawTimestamp = '' // Declare at the proper scope level
      
      // Use timestamp from CSV directly - handle different formats
      const timestampValue = row['Timestamp'] || row['timestamp'] || row['Time'] || row['time']
      
      if (timestampValue && timestampValue !== '') {
        // Store the raw timestamp string for display
        rawTimestamp = timestampValue.toString().trim()
        
        // For sorting and filtering, create a simple numeric timestamp
        // If it's time-only format like "01:29:07", combine with today's date
        let timestamp: number
        if (rawTimestamp.match(/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/)) {
          // Time-only format - create timestamp with today's date
          const today = new Date()
          const [hours, minutes, secondsPart] = rawTimestamp.split(':')
          const seconds = parseFloat(secondsPart || '0')
          
          const timeDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                                   parseInt(hours), parseInt(minutes), Math.floor(seconds), 
                                   Math.round((seconds % 1) * 1000))
          timestamp = timeDate.getTime()
          
          // console.log(`⏰ Time-only timestamp: ${rawTimestamp} -> ${timeDate.toLocaleString()}`)
        } else {
          // Try to parse as regular date/time
          const parsed = new Date(rawTimestamp)
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed.getTime()
          } else {
            // Fallback: use current time with incrementing milliseconds
            timestamp = Date.now() + (data.length * 1000)
            // console.warn(`⚠️ Could not parse timestamp: ${rawTimestamp}, using fallback`)
          }
        }
      } else {
        // No timestamp found - use incremental time and generate raw timestamp
        timestamp = Date.now() + (data.length * 1000)
        rawTimestamp = new Date(timestamp).toLocaleTimeString()
        // console.warn('⚠️ No timestamp found in row, using generated timestamp')
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
 * Filter data to get only the most recent N minutes
 */
export function getRecentData(data: CSVSensorData[], minutes: number = 1): CSVSensorData[] {
  if (data.length === 0) return []
  
  // console.log(`🕐 Filtering data for last ${minutes} minute(s) from ${data.length} total points`)
  
  // Sort by timestamp descending (most recent first)
  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp)
  
  if (sortedData.length === 0) return []
  
  // Get the most recent timestamp
  const latestTimestamp = sortedData[0].timestamp
  // console.log(`🕐 Latest data timestamp: ${new Date(latestTimestamp).toLocaleString()}`)
  
  // Calculate cutoff time (minutes ago from the latest data point)
  const cutoffTime = latestTimestamp - (minutes * 60 * 1000) // Convert minutes to milliseconds
  // console.log(`🕐 Cutoff time: ${new Date(cutoffTime).toLocaleString()}`)
  
  // Filter data within the time window
  const filteredData = sortedData.filter(item => item.timestamp >= cutoffTime)
  
  // console.log(`✅ Filtered ${data.length} total points to ${filteredData.length} points for last ${minutes} minute(s)`)
  // console.log(`🕐 Time range: ${new Date(cutoffTime).toLocaleString()} to ${new Date(latestTimestamp).toLocaleString()}`)
  
  return filteredData
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
    
    rows.push(`${timestamp.toISOString()},${30-i},${vibration},${acceleration},${strain},${temperature}`)
  }
  
  return headers + '\n' + rows.join('\n')
}