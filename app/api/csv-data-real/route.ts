import { NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData } from "@/lib/csv-handler"
import { GoogleDriveAuthenticatedClient, getLatestCSVWithAPIKey } from '@/lib/google-drive-auth'
import { getCSVFromGoogleDrive } from '@/lib/simple-google-api'

// Your Google Drive folder ID
const DRIVE_FOLDER_ID = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM'

// Get the latest CSV file using authenticated Google Drive access
async function getLatestRealCSV(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔐 Getting latest CSV with multiple Google Drive access methods...')
    console.log('📂 Using folder ID:', DRIVE_FOLDER_ID)
    console.log('🔑 API Key available:', !!process.env.GOOGLE_DRIVE_API_KEY)
    
    // Method 1: Try simple Google Drive API first (most reliable)
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

    // Method 2: Direct file access using known patterns
    try {
      console.log('🔍 Attempting direct file pattern access...')
      const result = await getLatestRealCSVFallback()
      
      if (result && result.content && result.content.length > 100) {
        console.log('✅ SUCCESS: Got real CSV data via direct pattern access')
        return result
      }
    } catch (patternError) {
      console.log('⚠️ Pattern access failed:', patternError)
    }

    // Method 3: Try OAuth authenticated client
    try {
      console.log('🔑 Attempting OAuth authentication...')
      const client = new GoogleDriveAuthenticatedClient()
      const result = await client.getLatestCSVFile()
      
      if (result) {
        console.log('✅ SUCCESS: Got real CSV data via OAuth authentication')
        return result
      }
    } catch (authError) {
      console.log('⚠️ OAuth authentication failed:', authError)
    }

    // Method 4: Try API key method (for public/shared access)
    try {
      console.log('🔑 Attempting API key access...')
      const result = await getLatestCSVWithAPIKey()
      
      if (result) {
        console.log('✅ SUCCESS: Got real CSV data via API key')
        return result
      }
    } catch (apiError) {
      console.log('⚠️ API key method failed:', apiError)
    }

    console.log('❌ All methods failed to retrieve CSV data')
    return null
    
  } catch (error) {
    console.error('❌ All Google Drive access methods failed:', error)
    return null
  }
}

// Fallback method using direct file access patterns  
async function getLatestRealCSVFallback(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔍 Using fallback method - trying direct file patterns...')
    
    // First, try to access known working files directly
    const knownWorkingIds = [
      '1HB9Bb8j9fVFjsP-TdGvJlRsPCc8-9KGj', // Example ID, you can add more if you know them
      // Add more known file IDs here if available
    ]
    
    for (const fileId of knownWorkingIds) {
      try {
        console.log(`🎯 Trying known file ID: ${fileId}`)
        
        const content = await tryDirectFileAccess(fileId)
        if (content) {
          return {
            filename: `${fileId}.csv`,
            content: content
          }
        }
      } catch (err) {
        console.log(`❌ Known file ${fileId} failed:`, err)
      }
    }
    
    // Generate recent file patterns based on current time (matching your naming: 2025-12-23_01-40)
    const patterns = generateRecentFilePatterns()
    
    for (const pattern of patterns.slice(0, 15)) { // Try first 15 patterns
      try {
        console.log(`🔍 Trying file pattern: ${pattern}`)
        
        const content = await tryDirectFileAccess(pattern)
        if (content) {
          return {
            filename: `${pattern}.csv`,
            content: content
          }
        }
      } catch (err) {
        // Continue to next pattern
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Error in fallback method:', error)
    return null
  }
}

// Helper function to try accessing a file directly
async function tryDirectFileAccess(fileId: string): Promise<string | null> {
  try {
    // Try different Google Drive access methods (prioritize Google Sheets export)
    const urls = [
      `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
      `https://drive.google.com/uc?id=${fileId}&export=download`,
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
              (content.includes('Device,Timestamp') || content.includes('Device')) && 
              content.includes('88A29E218213')) {
            
            console.log(`✅ SUCCESS: Got real CSV data (${content.length} chars) from ${url}`)
            return content
          } else if (content && content.length > 50) {
            console.log(`📄 Got content but not CSV format: ${content.substring(0, 100)}...`)
          }
        } else {
          console.log(`❌ ${url} failed: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.log(`❌ URL ${url} error:`, err)
        // Continue to next URL
      }
    }
    
    return null
    
  } catch (error) {
    console.log(`❌ Direct access error for ${fileId}:`, error)
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
      console.log(`🔍 Raw CSV content (first 500 chars):`)
      console.log(result.content.substring(0, 500))
      
      const lines = result.content.trim().split('\n')
      if (lines.length > 0) {
        console.log(`🔍 Headers: "${lines[0]}"`)
      }
      if (lines.length > 1) {
        console.log(`🔍 Sample data row 1: "${lines[1]}"`)
      }
      if (lines.length > 2) {
        console.log(`🔍 Sample data row 2: "${lines[2]}"`)
      }
      
      // Parse the real CSV content
      const parsedData = parseCSVToSensorData(result.content)
      
      if (parsedData.length > 0) {
        allData = parsedData
        dataSource = 'google-drive-real'
        filename = result.filename
        
        console.log(`✅ Successfully parsed ${parsedData.length} real data points from ${filename}`)
        console.log(`🔍 First parsed data point:`, {
          timestamp: new Date(parsedData[0].timestamp).toLocaleString(),
          temperature_c: parsedData[0].temperature_c,
          stroke_mm: parsedData[0].stroke_mm,
          x: parsedData[0].x,
          y: parsedData[0].y,
          z: parsedData[0].z
        })
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