import { SensorData } from './data-generator'
import { GoogleDriveCSVReader, EXTRACTED_FOLDER_ID } from './google-drive'

export interface CSVSensorData extends SensorData {
  id?: string
  created_at?: string
}

/**
 * Parse CSV content and convert to sensor data format
 */
export function parseCSVToSensorData(csvContent: string): CSVSensorData[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return [] // Need at least header + 1 data row
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  console.log('CSV headers found:', headers)
  
  const data: CSVSensorData[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) {
      console.warn(`Row ${i} has ${values.length} columns but expected ${headers.length}`)
      continue
    }
    
    const row: any = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    
    // Convert to standard sensor data format
    try {
      // Try to find timestamp column (various possible names)
      let timestamp = Date.now()
      const timeFields = ['created_at', 'timestamp', 'time', 'date', 'datetime']
      for (const field of timeFields) {
        if (row[field] && row[field] !== '') {
          let parsedTime
          
          // Handle time-only format (like "19:59:09") - combine with today's date
          if (row[field].match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            const today = new Date().toISOString().split('T')[0] // Get today's date
            parsedTime = new Date(`${today}T${row[field]}`).getTime()
          } else {
            parsedTime = new Date(row[field]).getTime()
          }
          
          if (!isNaN(parsedTime)) {
            timestamp = parsedTime
            break
          }
        }
      }
      
      // Map your specific CSV columns to sensor data
      // Your format: Device, Timestamp, X, Y, Z, Stroke_mm, Temperature_C
      const vibrationFields = ['x', 'y', 'z', 'vibration', 'field1', 'vib', 'hz', 'frequency']
      const accelerationFields = ['x', 'y', 'z', 'acceleration', 'field2', 'acc', 'accel', 'g-force']
      const strainFields = ['stroke_mm', 'strain', 'field3', 'stress', 'tension', 'με', 'microstrain']
      const temperatureFields = ['temperature_c', 'temperature', 'field4', 'temp', 'celsius', 'c']
      
      const findValue = (fields: string[]): number => {
        for (const field of fields) {
          if (row[field] && row[field] !== '') {
            const val = parseFloat(row[field])
            if (!isNaN(val)) return val
          }
        }
        return 0
      }
      
      // Calculate vibration magnitude from X, Y, Z components if available
      let vibration = findValue(vibrationFields)
      if (vibration === 0 && row['x'] && row['y'] && row['z']) {
        const x = parseFloat(row['x']) || 0
        const y = parseFloat(row['y']) || 0  
        const z = parseFloat(row['z']) || 0
        vibration = Math.sqrt(x*x + y*y + z*z) // Magnitude of acceleration vector
      }
      
      // Use X-axis acceleration as primary acceleration reading
      let acceleration = findValue(accelerationFields)
      if (acceleration === 0 && row['x']) {
        acceleration = Math.abs(parseFloat(row['x']) || 0)
      }
      
      const sensorData: CSVSensorData = {
        timestamp,
        vibration,
        acceleration,
        strain: findValue(strainFields),
        temperature: findValue(temperatureFields),
        id: row.device || row.entry_id || row.id || `${i}`,
        created_at: row.created_at || new Date(timestamp).toISOString()
      }
      
      // Only add if we have at least one valid sensor reading
      if (sensorData.vibration !== 0 || sensorData.acceleration !== 0 || 
          sensorData.strain !== 0 || sensorData.temperature !== 0) {
        data.push(sensorData)
        
        // Log first few data points for debugging
        if (data.length <= 3) {
          console.log(`Sample data point ${data.length}:`, {
            timestamp: new Date(sensorData.timestamp).toLocaleString(),
            vibration: sensorData.vibration,
            acceleration: sensorData.acceleration,
            strain: sensorData.strain,
            temperature: sensorData.temperature,
            rawRow: row
          })
        }
      } else {
        console.warn(`Row ${i} skipped - no valid sensor data:`, row)
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
  
  if (allFromToday && minutes === 1) {
    // For time-only data, return last 20 data points (roughly 1 minute worth)
    console.log(`Returning last ${Math.min(20, sortedData.length)} data points from today's data`)
    return sortedData.slice(0, Math.min(20, sortedData.length))
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