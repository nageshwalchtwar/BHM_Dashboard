import { NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"

// Your Google Drive folder ID
const DRIVE_FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai'

// Try to get the latest CSV file from Google Drive
async function getLatestRealCSV(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔍 Getting latest CSV from your Google Drive folder...')
    
    // Generate recent file patterns based on current time (matching your naming: 2025-12-23_01-40)
    const patterns = generateRecentFilePatterns()
    
    for (const pattern of patterns.slice(0, 15)) { // Try first 15 patterns
      try {
        console.log(`🔍 Trying file pattern: ${pattern}`)
        
        // Try different Google Drive access methods
        const urls = [
          `https://docs.google.com/spreadsheets/d/${pattern}/export?format=csv`,
          `https://drive.google.com/uc?id=${pattern}&export=download`,
        ]
        
        for (const url of urls) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'User-Agent': 'BHM-Dashboard/1.0',
                'Accept': 'text/csv,application/csv,text/plain,*/*'
              }
            })
            
            if (response.ok) {
              const content = await response.text()
              
              // Check if it's your real CSV format
              if (content && content.length > 100 && 
                  content.includes('Device,Timestamp') && 
                  content.includes('88A29E218213')) {
                
                console.log(`✅ SUCCESS: Got real CSV data (${content.length} chars)`)
                return {
                  filename: `${pattern}.csv`,
                  content: content
                }
              }
            }
          } catch (err) {
            // Continue to next URL
          }
        }
      } catch (err) {
        // Continue to next pattern
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Error accessing Google Drive:', error)
    return null
  }
}

// Generate file patterns based on current date/time (matching your format)
function generateRecentFilePatterns(): string[] {
  const now = new Date()
  const patterns: string[] = []
  
  // Generate patterns for the last 2 hours with 10-minute intervals
  for (let minutesBack = 0; minutesBack < 120; minutesBack += 10) {
    const targetTime = new Date(now.getTime() - (minutesBack * 60 * 1000))
    
    const year = targetTime.getFullYear()
    const month = String(targetTime.getMonth() + 1).padStart(2, '0')
    const day = String(targetTime.getDate()).padStart(2, '0')
    const hour = String(targetTime.getHours()).padStart(2, '0')
    const minute = String(Math.floor(targetTime.getMinutes() / 10) * 10).padStart(2, '0')
    
    patterns.push(`${year}-${month}-${day}_${hour}-${minute}`)
  }
  
  return patterns
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1")

  try {
    console.log('🎯 Fetching latest REAL CSV data from your Google Drive...')
    console.log('📂 Folder:', `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`)
    
    // Try to get real CSV data from Google Drive
    const result = await getLatestRealCSV()
    
    let allData: any[] = []
    let dataSource = ''
    let filename = ''
    
    if (result && result.content) {
      console.log(`📊 Parsing real CSV: ${result.filename}`)
      
      // Parse the real CSV content
      const parsedData = parseCSVToSensorData(result.content)
      
      if (parsedData.length > 0) {
        allData = parsedData
        dataSource = 'google-drive-real'
        filename = result.filename
        
        console.log(`✅ Successfully parsed ${parsedData.length} real data points from ${filename}`)
      }
    }
    
    // If no real data available, return error (NO FAKE DATA)
    if (allData.length === 0) {
      console.log('❌ No real CSV data available - refusing to return fake data')
      return NextResponse.json({
        success: false,
        error: "No real CSV data available from Google Drive",
        message: "Could not access the latest CSV file from your Google Drive folder",
        folderUrl: `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`,
        expectedFilePattern: generateRecentFilePatterns()[0] + '.csv',
        debug: {
          tried: generateRecentFilePatterns().slice(0, 5),
          currentTime: new Date().toISOString()
        }
      }, { status: 404 })
    }
    
    // Sort by timestamp (newest first)
    allData.sort((a, b) => b.timestamp - a.timestamp)
    
    // Get recent data based on requested timeframe
    const recentData = getRecentData(allData, minutes)
    
    console.log(`📈 Returning ${recentData.length} REAL data points from last ${minutes} minute(s)`)
    
    return NextResponse.json({
      success: true,
      data: recentData,
      metadata: {
        source: dataSource,
        filename: filename,
        totalPoints: allData.length,
        recentPoints: recentData.length,
        timeframe: `${minutes} minute(s)`,
        lastUpdate: new Date().toISOString(),
        latestDataTime: recentData[0] ? new Date(recentData[0].timestamp).toLocaleString() : null,
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
    
    // Parse the uploaded CSV content (real data only)
    const parsedData = parseCSVToSensorData(csvContent)
    console.log(`📤 Processed uploaded CSV: ${parsedData.length} data points`)
    
    return NextResponse.json({
      success: true,
      message: `Real CSV data processed successfully - ${parsedData.length} data points`,
      count: parsedData.length,
      lastUpdate: new Date().toISOString(),
      isRealData: true
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