import { NextResponse } from "next/server"
import { DriveDirectAccess } from "@/lib/drive-scraper"
import { SimpleGoogleDriveReader, getLatestCSVSimple } from "@/lib/simple-drive-reader"
import { RealGoogleDriveReader } from "@/lib/real-drive-reader"
import { fetchLatestCSVData, parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"

// Temporary in-memory storage for uploaded CSV data
let uploadedCSVData: any[] = []
let lastUploadTime: Date | null = null

// Automatic fetching cache
let cachedAutoData: any[] = []
let lastAutoFetch: Date | null = null
const AUTO_FETCH_INTERVAL = 2 * 60 * 1000 // 2 minutes

const DRIVE_FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai'

async function attemptAutoFetch(): Promise<{ data: any[], source: string, error?: string, filename?: string }> {
  const now = new Date()
  
  // Check if we need to fetch (first time or interval passed)
  if (!lastAutoFetch || (now.getTime() - lastAutoFetch.getTime()) > AUTO_FETCH_INTERVAL) {
    console.log('🔄 Attempting to access REAL CSV files from Google Drive...')
    
    // Priority 1: Try Real Google Drive Reader (for actual files)
    try {
      console.log('🎯 Trying RealGoogleDriveReader for actual CSV files...')
      const realReader = new RealGoogleDriveReader(DRIVE_FOLDER_ID)
      const result = await realReader.getLatestRealCSV()
      
      if (result && result.content && result.content.includes('Device,Timestamp')) {
        console.log(`✅ SUCCESS: Got real data from ${result.filename}`)
        const parsedData = parseCSVToSensorData(result.content)
        cachedAutoData = parsedData
        lastAutoFetch = now
        return { data: parsedData, source: 'real-csv-file', filename: result.filename }
      }
    } catch (error) {
      console.log('⚠️ RealGoogleDriveReader failed:', error)
    }
    
    // Priority 2: Try Simple Google Drive Reader  
    try {
      console.log('🔍 Trying SimpleGoogleDriveReader...')
      const csvContent = await getLatestCSVSimple(DRIVE_FOLDER_ID)
      
      if (csvContent && csvContent.length > 100 && csvContent.includes('Device,Timestamp')) {
        console.log('✅ SimpleGoogleDriveReader got real data')
        const parsedData = parseCSVToSensorData(csvContent)
        cachedAutoData = parsedData
        lastAutoFetch = now
        return { data: parsedData, source: 'simple-auto' }
      }
    } catch (error) {
      console.log('⚠️ SimpleGoogleDriveReader failed:', error)
    }
    
    // Priority 3: Try Original DriveDirectAccess  
    try {
      console.log('🔍 Trying DriveDirectAccess...')
      const driveAccess = new DriveDirectAccess(DRIVE_FOLDER_ID)
      const result = await driveAccess.getLatestCSV()
      
      if (result && result.content && result.content.includes('Device,Timestamp')) {
        console.log('✅ DriveDirectAccess got real data')
        const parsedData = parseCSVToSensorData(result.content)
        cachedAutoData = parsedData
        lastAutoFetch = now
        return { data: parsedData, source: 'direct-auto' }
      }
    } catch (error) {
      console.log('⚠️ DriveDirectAccess failed:', error)
    }
    
    return { 
      data: cachedAutoData, 
      source: 'cached', 
      error: 'Cannot access real CSV files automatically. Please use upload method or check /api/real-data-help for instructions.' 
    }
  }
  
  return { data: cachedAutoData, source: 'cached' }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1")

  try {
    let dataSource = 'none'
    let allData: any[] = []
    let lastUpdate = new Date()
    let debugInfo: any = {}
    
    // Priority 1: Use uploaded data if available
    if (uploadedCSVData.length > 0 && lastUploadTime) {
      console.log(`📁 Using uploaded CSV data (${uploadedCSVData.length} points)`)
      allData = uploadedCSVData
      dataSource = 'uploaded'
      lastUpdate = lastUploadTime
    } else {
      // Priority 2: Try automatic fetching
      const autoResult = await attemptAutoFetch()
      
      if (autoResult.data.length > 0) {
        console.log(`🤖 Using auto-fetched data (${autoResult.data.length} points)`)
        allData = autoResult.data
        dataSource = autoResult.source
        lastUpdate = lastAutoFetch || new Date()
        debugInfo.autoFetchMethod = autoResult.source
        if (autoResult.error) debugInfo.autoFetchWarning = autoResult.error
      } else {
        // Priority 3: Fall back to Google Drive API
        try {
          console.log('🔑 Trying Google Drive API fallback...')
          const data = await fetchLatestCSVData()
          allData = data
          dataSource = 'google-drive-api'
          debugInfo.fallbackUsed = true
        } catch (error) {
          console.error('All data sources failed:', error)
          return NextResponse.json({
            success: false,
            error: "No CSV data available",
            message: "🎯 To get your real data working immediately:",
            instructions: [
              "1. Open Google Drive → BHM_D1 folder", 
              "2. Click your latest file: 2025-12-20_20-50 (or newer)",
              "3. Select All (Ctrl+A) → Copy (Ctrl+C)",
              "4. Go to /upload page on this dashboard",
              "5. Paste content → Click 'Process CSV Data'",
              "6. Refresh this page to see your real charts!"
            ],
            quickLink: "/upload",
            source: "none",
            debug: {
              uploadedData: uploadedCSVData.length,
              lastAutoFetch: lastAutoFetch?.toISOString(),
              autoFetchError: autoResult.error,
              googleApiError: error instanceof Error ? error.message : 'Unknown error',
              folderUrl: `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`
            }
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
      autoFetchStatus: lastAutoFetch ? `Last auto-fetch: ${lastAutoFetch.toISOString()}` : 'No auto-fetch attempted yet',
      debug: debugInfo
    })
  } catch (error) {
    console.error('Error fetching latest CSV data:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to fetch latest CSV data",
      message: error instanceof Error ? error.message : "Unknown error",
      debug: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      }
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