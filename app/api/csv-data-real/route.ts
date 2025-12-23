import { NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive } from '@/lib/simple-google-api'

// Your Google Drive folder ID - use environment variable with fallback
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM'

// Get the latest CSV file using Google Drive API
async function getLatestRealCSV(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔐 Getting latest CSV with Google Drive API...')
    console.log('📂 Using folder ID:', DRIVE_FOLDER_ID)
    console.log('🔑 API Key available:', !!process.env.GOOGLE_DRIVE_API_KEY)
    
    // Use only the Simple Google Drive API (most reliable)
    try {
      console.log('🚀 Attempting Simple Google Drive API...')
      const result = await getCSVFromGoogleDrive()
      
      if (result && result.content && result.content.length > 100) {
        console.log(`✅ SUCCESS: Got real CSV data via Simple Google Drive API (${result.content.length} chars)`)
        console.log(`📄 First 200 chars: ${result.content.substring(0, 200)}...`)
        return result
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1") // Default to 1 minute
  
  console.log(`📊 API Request: Getting data for last ${minutes} minute(s)`)

  try {
    console.log('🎯 Fetching latest REAL CSV data from your Google Drive...')
    console.log('📂 Folder:', `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`)
    
    // Try to get real CSV data from Google Drive
    const result = await getLatestRealCSV()
    
    let allData: any[] = []
    let dataSource = ''
    let filename = ''

    if (result && result.content) {
      console.log('🎉 Got real CSV data!')
      filename = result.filename
      dataSource = 'Google Drive (Real Data)'
      
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
        message: "Could not access the latest CSV file from your Google Drive folder",
        folderUrl: `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`,
        debug: {
          currentTime: new Date().toISOString()
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
        isRealData: true
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