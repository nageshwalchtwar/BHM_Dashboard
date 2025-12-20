import { SensorData } from './data-generator'
import { createGoogleDriveReader, EXTRACTED_FOLDER_ID } from './google-drive'

export interface CSVSensorData extends SensorData {
  id?: string
  created_at?: string
}

/**
 * Parse CSV content and convert to sensor data format
 */
export function parseCSVToSensorData(csvContent: string): CSVSensorData[] {
  const lines = csvContent.trim().split('\n')
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  
  const data: CSVSensorData[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    
    // Convert to standard sensor data format
    try {
      const sensorData: CSVSensorData = {
        timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        vibration: parseFloat(row.vibration || row.field1 || '0'),
        acceleration: parseFloat(row.acceleration || row.field2 || '0'),
        strain: parseFloat(row.strain || row.field3 || '0'),
        temperature: parseFloat(row.temperature || row.field4 || '0'),
        id: row.entry_id || row.id,
        created_at: row.created_at
      }
      
      // Only add if we have valid data
      if (!isNaN(sensorData.vibration) || !isNaN(sensorData.acceleration) || 
          !isNaN(sensorData.strain) || !isNaN(sensorData.temperature)) {
        data.push(sensorData)
      }
    } catch (error) {
      console.warn('Error parsing row:', i, error)
    }
  }
  
  return data
}

/**
 * Filter data to get only the most recent N minutes
 */
export function getRecentData(data: CSVSensorData[], minutes: number = 1): CSVSensorData[] {
  if (data.length === 0) return []
  
  const now = Date.now()
  const cutoffTime = now - (minutes * 60 * 1000) // Convert minutes to milliseconds
  
  // Sort by timestamp descending (most recent first)
  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp)
  
  // Filter for recent data
  return sortedData.filter(item => item.timestamp >= cutoffTime)
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
    // Try to use Google Drive API if configured
    if (process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
      const driveReader = createGoogleDriveReader()
      const csvContent = await driveReader.getLatestCSVContent()
      
      if (csvContent) {
        const parsedData = parseCSVToSensorData(csvContent)
        return getRecentData(parsedData, 1) // Get last 1 minute of data
      }
    }
    
    // Fallback to mock data for development/demo
    console.log('Using mock data - configure Google Drive credentials for real data')
    const mockCSVContent = generateMockCSVContent()
    const parsedData = parseCSVToSensorData(mockCSVContent)
    return getRecentData(parsedData, 1) // Get last 1 minute of data
    
  } catch (error) {
    console.error('Error fetching CSV data:', error)
    
    // Fallback to mock data on error
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