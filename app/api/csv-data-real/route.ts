import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// Get the latest CSV file using Google Drive API with device support
async function getLatestRealCSV(minutes = 60, deviceId?: string): Promise<{filename: string, content: string, device?: any} | null> {
  try {
    // Get folder ID for the specified device (or default)
    const folderId = getFolderIdForDevice(deviceId);
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice();
    
    console.log('🔐 Getting latest CSV with Google Drive API...')
    console.log('📂 Using device:', device?.name || 'Unknown')
    console.log('📂 Using folder ID:', folderId)
    console.log('🔑 API Key available:', !!process.env.GOOGLE_DRIVE_API_KEY)
    
    // Use only the Simple Google Drive API (most reliable)
    try {
      console.log('🚀 Attempting Simple Google Drive API...')
      const result = await getCSVFromGoogleDrive(folderId)
      
      if (result && result.content && result.content.length > 100) {
        console.log(`✅ SUCCESS: Got real CSV data via Simple Google Drive API (${result.content.length} chars)`)
        console.log(`📄 First 200 chars: ${result.content.substring(0, 200)}...`)
        return { ...result, device }
      } else if (result) {
        console.log('⚠️ Simple API returned empty/invalid content:', result.content?.substring(0, 100))
      }
    } catch (simpleError) {
      console.log('⚠️ Simple Google Drive API failed:', simpleError)
    }

    console.log('❌ No CSV data could be retrieved')
    return null
    
  } catch (error) {
    console.error('❌ Error getting latest CSV:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1") // Default to 1 minute
  const deviceId = searchParams.get("device") // Optional device parameter
  
  console.log(`📊 API Request: Getting data for last ${minutes} minute(s) from device: ${deviceId || 'default'}`)

  try {
    console.log('🎯 Fetching latest REAL CSV data from Google Drive...')
    
    // Try to get real CSV data from Google Drive for specific device
    const result = await getLatestRealCSV(minutes, deviceId)
    
    let allData: any[] = []
    let dataSource = ''
    let filename = ''
    let device = null

    if (result && result.content) {
      console.log('🎉 Got real CSV data!')
      filename = result.filename
      device = result.device
      dataSource = `Google Drive (${device?.name || 'Real Data'})`
      console.log('📂 Using device folder:', device?.folderUrl)
      
      // Parse the CSV content to sensor data format
      allData = parseCSVToSensorData(result.content)
      console.log(`📈 Parsed ${allData.length} data points from real CSV`)
      
      if (allData.length === 0) {
        console.log('⚠️ Warning: No data points parsed from CSV')
      }
    } else {
      console.log('❌ No real CSV data available - refusing to return fake data')
      return NextResponse.json({
        success: false,
        error: "No real CSV data available from Google Drive",
        message: `Could not access the latest CSV file from Google Drive for device: ${deviceId || 'default'}`,
        device: deviceId ? { id: deviceId, status: 'not found' } : null,
        debug: {
          currentTime: new Date().toISOString(),
          requestedDevice: deviceId || 'default'
        }
      }, { status: 404 })
    }
    
    // Sort by timestamp (newest first)
    allData.sort((a, b) => b.timestamp - a.timestamp)
    
    // Get recent data based on requested timeframe (max 10 minutes)
    const filteredData = getRecentData(allData, Math.min(minutes, 10))
    const timeframeDescription = `${minutes} minute(s)`
    
    console.log(`📈 Returning ${filteredData.length} REAL data points from last ${minutes} minute(s)`)
    console.log(`📊 Data time range: ${filteredData.length > 0 ? new Date(filteredData[filteredData.length - 1].timestamp).toLocaleString() + ' to ' + new Date(filteredData[0].timestamp).toLocaleString() : 'No data'}`)
    
    return NextResponse.json({
      success: true,
      data: filteredData,
      metadata: {
        source: dataSource,
        filename: filename,
        totalPoints: allData.length,
        recentPoints: filteredData.length,
        timeframe: timeframeDescription,
        lastUpdate: new Date().toISOString(),
        latestDataTime: filteredData[0] ? new Date(filteredData[0].timestamp).toLocaleString() : null,
        isRealData: true,
        device: device ? {
          id: device.id,
          name: device.name,
          description: device.description,
          folderUrl: device.folderUrl
        } : null
      }
    })
    
  } catch (error) {
    console.error('❌ CSV data error:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to get real CSV data",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Keep POST for backward compatibility but disable fake data generation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { csvContent } = body
    
    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: "No CSV content provided"
      }, { status: 400 })
    }

    console.log('📊 Processing provided CSV content...')
    const data = parseCSVToSensorData(csvContent)
    
    return NextResponse.json({
      success: true,
      data: data,
      metadata: {
        source: 'User Provided',
        filename: 'user-upload.csv',
        totalPoints: data.length,
        lastUpdate: new Date().toISOString()
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to process CSV content",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}