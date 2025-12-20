import { NextResponse } from "next/server"
import { DriveDirectAccess } from "@/lib/drive-scraper"
import { fetchLatestCSVData, parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"

// Temporary in-memory storage for uploaded CSV data
let uploadedCSVData: any[] = []
let lastUploadTime: Date | null = null

// Automatic fetching cache
let cachedAutoData: any[] = []
let lastAutoFetch: Date | null = null
const AUTO_FETCH_INTERVAL = 2 * 60 * 1000 // 2 minutes

const DRIVE_FOLDER_ID = '1zkX_IaONxj6vRGgD2niwfPCVyAmGZBbE'

async function attemptAutoFetch(): Promise<any[]> {
  const now = new Date()
  
  // Check if we need to fetch (first time or interval passed)
  if (!lastAutoFetch || (now.getTime() - lastAutoFetch.getTime()) > AUTO_FETCH_INTERVAL) {
    console.log('🔄 Attempting automatic Google Drive fetch...')
    
    try {
      const driveAccess = new DriveDirectAccess(DRIVE_FOLDER_ID)
      const result = await driveAccess.getLatestCSV()
      
      if (result && result.content) {
        console.log(`✅ Auto-fetched: ${result.filename}`)
        const parsedData = parseCSVToSensorData(result.content)
        cachedAutoData = parsedData
        lastAutoFetch = now
        return parsedData
      } else {
        console.log('⚠️ Auto-fetch returned no data')
      }
    } catch (error) {
      console.error('❌ Auto-fetch failed:', error)
    }
  }
  
  return cachedAutoData
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1")

  try {
    let dataSource = 'none'
    let allData: any[] = []
    let lastUpdate = new Date()
    
    // Priority 1: Use uploaded data if available
    if (uploadedCSVData.length > 0 && lastUploadTime) {
      console.log(`📁 Using uploaded CSV data (${uploadedCSVData.length} points)`)
      allData = uploadedCSVData
      dataSource = 'uploaded'
      lastUpdate = lastUploadTime
    } else {
      // Priority 2: Try automatic fetching
      const autoData = await attemptAutoFetch()
      
      if (autoData.length > 0) {
        console.log(`🤖 Using auto-fetched data (${autoData.length} points)`)
        allData = autoData
        dataSource = 'auto-drive'
        lastUpdate = lastAutoFetch || new Date()
      } else {
        // Priority 3: Fall back to Google Drive API
        try {
          console.log('🔑 Trying Google Drive API fallback...')
          const data = await fetchLatestCSVData()
          allData = data
          dataSource = 'google-drive-api'
        } catch (error) {
          console.error('All data sources failed:', error)
          return NextResponse.json({
            success: false,
            error: "No data available",
            message: "Automatic fetching failed and no uploaded data available. The system is trying to automatically fetch from your Google Drive folder every 2 minutes.",
            source: "none"
          }, { status: 404 })
        }
      }
    }
    
    // Get recent data based on requested timeframe
    const recentData = getRecentData(allData, minutes)
    
    return NextResponse.json({
      success: true,
      data: recentData,
      count: recentData.length,
      totalCount: allData.length,
      timeRange: `${minutes} minute(s)`,
      lastUpdate: lastUpdate.toISOString(),
      message: `${recentData.length} data points from the most recent ${minutes} minute(s)`,
      source: dataSource,
      autoFetchStatus: lastAutoFetch ? `Last auto-fetch: ${lastAutoFetch.toISOString()}` : 'No auto-fetch attempted yet'
    })
  } catch (error) {
    console.error('Error fetching latest CSV data:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to fetch latest CSV data",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Handle CSV data upload
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
    
    // Parse the uploaded CSV content
    const parsedData = parseCSVToSensorData(csvContent)
    console.log(`📤 Processed uploaded CSV: ${parsedData.length} data points`)
    
    // Store in memory (in production, you'd use a database)
    uploadedCSVData = parsedData
    lastUploadTime = new Date()
    
    return NextResponse.json({
      success: true,
      message: `CSV data processed successfully - ${parsedData.length} data points`,
      count: parsedData.length,
      lastUpdate: lastUploadTime.toISOString()
    })
  } catch (error) {
    console.error('Error processing uploaded CSV:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to process CSV data",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}