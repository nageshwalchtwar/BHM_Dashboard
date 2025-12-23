import { SensorData } from './data-generator'
import { GoogleDriveCSVReader, EXTRACTED_FOLDER_ID } from './google-drive'

export interface CSVSensorData extends SensorData {
  id?: string
  created_at?: string
  // Your specific CSV columns
  x?: number
  y?: number
  z?: number
  stroke_mm?: number
  temperature_c?: number
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
  console.log('🔍 CSV headers found:', originalHeaders)
  console.log('🔍 Looking for columns: Temperature_C, Stroke_mm, X, Y, Z, Timestamp')
  
  const data: CSVSensorData[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) {
      console.warn(`Row ${i} has ${values.length} columns but expected ${headers.length}`)
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
      
      // Check for your specific Timestamp column first, then fallbacks
      const timestampValue = row['Timestamp'] || lowerRow['timestamp'] || 
                            lowerRow['time'] || lowerRow['created_at'] || lowerRow['date']
      
      if (timestampValue && timestampValue !== '') {
        let parsedTime
        
        // Handle time-only format (like "01:29:07") - combine with today's date
        if (timestampValue.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
          const today = new Date().toISOString().split('T')[0]
          parsedTime = new Date(`${today}T${timestampValue}`).getTime()
        } else {
          parsedTime = new Date(timestampValue).getTime()
        }
        
        if (!isNaN(parsedTime)) {
          timestamp = parsedTime
        }
      }
      
      // Parse values with exact column name matching first, then fallback to lowercase
      const parseValue = (exactName: string, fallbackName?: string): number => {
        let val = row[exactName] || (fallbackName ? lowerRow[fallbackName] : undefined)
        
        // Special handling for temperature - try multiple variations
        if ((exactName === 'Temperature_C' || fallbackName === 'temperature_c') && !val) {
          val = row['temperature_c'] || row['Temperature_c'] || row['TEMPERATURE_C'] || 
                lowerRow['temperature'] || lowerRow['temp'] || lowerRow['temperature_c']
        }
        
        // Debug Temperature_C specifically
        if (exactName === 'Temperature_C' || fallbackName === 'temperature_c') {
          console.log(`🌡️ Temperature_C parsing:`, {
            exactName,
            fallbackName,
            exactValue: row[exactName],
            fallbackValue: fallbackName ? lowerRow[fallbackName] : undefined,
            alternateValues: {
              'temperature_c': row['temperature_c'],
              'Temperature_c': row['Temperature_c'], 
              'TEMPERATURE_C': row['TEMPERATURE_C'],
              'temperature': lowerRow['temperature'],
              'temp': lowerRow['temp']
            },
            finalValue: val,
            allRowKeys: Object.keys(row),
            allValues: row
          })
        }
        
        if (val !== undefined && val !== null && val !== '') {
          const parsed = parseFloat(val)
          if (!isNaN(parsed)) return parsed
        }
        return 0
      }
      
      const sensorData: CSVSensorData = {
        timestamp,
        // Map to your exact CSV column names first
        x: parseValue('X', 'x'),
        y: parseValue('Y', 'y'), 
        z: parseValue('Z', 'z'),
        stroke_mm: parseValue('Stroke_mm', 'stroke_mm'),
        temperature_c: parseValue('Temperature_C', 'temperature_c'),
        // Keep legacy fields for backward compatibility
        vibration: parseValue('X', 'x'), // Use X for vibration chart
        acceleration: parseValue('Y', 'y'), // Use Y for acceleration chart  
        strain: parseValue('Stroke_mm', 'stroke_mm'), // Use stroke for strain chart
        temperature: parseValue('Temperature_C', 'temperature_c'), // Use temp_c for temperature chart
        id: `${i}`, // Use row number as ID instead of device column
        created_at: lowerRow['created_at'] || new Date(timestamp).toISOString()
      }
      
      // Always add data points - even if some values are zero, they're still valid measurements
      data.push(sensorData)
        
        // Log first few data points for debugging
        if (data.length <= 3) {
          console.log(`Sample data point ${data.length}:`, {
            timestamp: new Date(sensorData.timestamp).toLocaleString(),
            x: sensorData.x,
            y: sensorData.y,
            z: sensorData.z,
            stroke_mm: sensorData.stroke_mm,
            temperature_c: sensorData.temperature_c,
            rawRow: row,
            originalHeaders: originalHeaders
          })
        }
    } catch (error) {
      console.warn('Error parsing row:', i, error)
    }
  }
  
  console.log(`Successfully parsed ${data.length} valid data points from ${lines.length - 1} rows`)
  return data
}

/**
 * Filter data to get only the most recent N minutes
 */
export function getRecentData(data: CSVSensorData[], minutes: number = 1): CSVSensorData[] {
  if (data.length === 0) return []
  
  // Sort by timestamp descending (most recent first)
  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp)
  
  // If we have time-only timestamps (same day), just return the most recent entries
  // Check if all timestamps are from today
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)
  const allFromToday = sortedData.every(item => item.timestamp > oneDayAgo)
  
  if (allFromToday) {
    // For time-only data, return recent entries based on requested minutes
    let pointsToReturn
    if (minutes <= 1) {
      pointsToReturn = Math.min(20, sortedData.length) // ~1 minute
    } else if (minutes <= 10) {
      pointsToReturn = Math.min(200, sortedData.length) // ~10 minutes
    } else {
      pointsToReturn = Math.min(600, sortedData.length) // ~1 hour
    }
    console.log(`Returning last ${pointsToReturn} data points from today's data (${minutes} minutes requested)`)
    return sortedData.slice(0, pointsToReturn)
  }
  
  const cutoffTime = now - (minutes * 60 * 1000) // Convert minutes to milliseconds
  const filteredData = sortedData.filter(item => item.timestamp >= cutoffTime)
  
  console.log(`Filtered ${sortedData.length} total points to ${filteredData.length} recent points (last ${minutes} minutes)`)
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
    
    console.log('Attempting to fetch from Google Drive folder:', EXTRACTED_FOLDER_ID)
    
    // If no API key or access token, try direct public access first
    if (!process.env.GOOGLE_DRIVE_API_KEY && !process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
      console.log('No API credentials found, trying direct public access...')
      const directContent = await driveReader.tryDirectPublicAccess()
      if (directContent) {
        const parsedData = parseCSVToSensorData(directContent)
        return getRecentData(parsedData, 1)
      }
    }
    
    // Try to list files from the API
    const files = await driveReader.listCSVFiles()
    console.log(`Found ${files.length} CSV files in Google Drive`)
    
    if (files.length > 0) {
      const latestFile = files[0] // Already sorted by modifiedTime desc
      console.log('Latest file details:', {
        name: latestFile.name,
        modified: latestFile.modifiedTime,
        size: latestFile.size,
        id: latestFile.id
      })
      
      const csvContent = await driveReader.readFileContent(latestFile.id)
      console.log('CSV content preview:', csvContent.substring(0, 200) + '...')
      console.log('CSV content length:', csvContent.length, 'characters')
      
      if (csvContent && csvContent.trim()) {
        const parsedData = parseCSVToSensorData(csvContent)
        console.log('Parsed', parsedData.length, 'data points from CSV')
        
        const recentData = getRecentData(parsedData, 1) // Get last 1 minute of data
        console.log('Filtered to', recentData.length, 'recent data points')
        
        if (recentData.length > 0) {
          console.log('Successfully returning real CSV data!')
          return recentData
        } else {
          console.log('No recent data found in CSV, using mock data')
        }
      }
    } else {
      console.log('No CSV files found in the Google Drive folder')
    }
    
    // If no files or empty content, fall back to mock data
    console.log('No valid CSV data found, using mock data for demo')
    const mockCSVContent = generateMockCSVContent()
    const parsedData = parseCSVToSensorData(mockCSVContent)
    return getRecentData(parsedData, 1)
    
  } catch (error) {
    console.error('Error fetching CSV data from Google Drive:', error)
    console.log('Error details:', error instanceof Error ? error.message : error)
    
    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      console.log('🔑 Google Drive API key is required to access your CSV files')
      console.log('📁 Your folder ID:', EXTRACTED_FOLDER_ID)
      console.log('🌐 Folder URL: https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai')
      console.log('⚙️  Setup: Get API key from Google Cloud Console → Add to Vercel environment variables')
    }
    
    // Fallback to mock data on error
    console.log('Falling back to mock data due to error')
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