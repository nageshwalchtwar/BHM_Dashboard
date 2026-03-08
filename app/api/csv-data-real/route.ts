import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData, getLatestRMSValues, downsampleToRMSPerSecond } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// Get the latest CSV file using Google Drive API with device support
async function getLatestRealCSV(minutes = 60, deviceId?: string): Promise<{ filename: string, content: string, device?: any } | null> {
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
  const samplesPerSecond = searchParams.get("samplesPerSecond") // Optional sampling rate
  const downsampleRMS = searchParams.get("downsampleRMS") === "1" // Enable RMS downsampling if set
  const startDate = searchParams.get("startDate") // Optional start date (ISO string)
  const endDate = searchParams.get("endDate") // Optional end date (ISO string)
  const dataMode = searchParams.get("dataMode") || "live" // "live", "fullday", "range"

  console.log(`📊 API Request: mode=${dataMode}, minutes=${minutes}, device=${deviceId || 'default'}, samples/sec=${samplesPerSecond || 'raw'}, startDate=${startDate}, endDate=${endDate}`)

  try {
    console.log('🎯 Fetching latest REAL CSV data from Google Drive...')

    // Try to get real CSV data from Google Drive for specific device
    const result = await getLatestRealCSV(minutes, deviceId || undefined)

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

    // Filter data based on mode
    let filteredData: any[];
    let timeframeDescription: string;

    if (dataMode === "range" && startDate && endDate) {
      // Date range mode: filter by start/end dates
      const startMs = new Date(startDate).getTime()
      const endMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1) // End of the end date
      filteredData = allData.filter((d: any) => d.timestamp >= startMs && d.timestamp <= endMs)
      timeframeDescription = `${startDate} to ${endDate}`
      console.log(`📅 Date range filter: ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()} → ${filteredData.length} points`)
    } else if (dataMode === "fullday" && startDate) {
      // Full day mode: show all data for a specific day
      const dayStart = new Date(startDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(startDate)
      dayEnd.setHours(23, 59, 59, 999)
      filteredData = allData.filter((d: any) => d.timestamp >= dayStart.getTime() && d.timestamp <= dayEnd.getTime())
      timeframeDescription = `Full day: ${startDate}`
      console.log(`📅 Full day filter: ${dayStart.toISOString()} to ${dayEnd.toISOString()} → ${filteredData.length} points`)
    } else {
      // Live mode: use minutes-based filtering (max 1440 = 24h)
      filteredData = getRecentData(allData, Math.min(minutes, 1440), samplesPerSecond)
      timeframeDescription = `${minutes} minute(s)`
    }

    // Apply sample rate filtering for date modes too
    if ((dataMode === "range" || dataMode === "fullday") && samplesPerSecond && samplesPerSecond !== "raw") {
      const targetSps = parseInt(samplesPerSecond)
      if (filteredData.length > 0) {
        const totalSeconds = (filteredData[0].timestamp - filteredData[filteredData.length - 1].timestamp) / 1000
        const targetPoints = Math.ceil(totalSeconds * targetSps)
        if (filteredData.length > targetPoints) {
          const step = Math.ceil(filteredData.length / targetPoints)
          filteredData = filteredData.filter((_: any, i: number) => i % step === 0)
        }
      }
    }

    // Calculate RMS BEFORE capping data (uses only last 1 second of data)
    let responseRMS = getLatestRMSValues(filteredData, samplesPerSecond ? parseInt(samplesPerSecond) : 40);

    let responseData: any = filteredData;

    if (downsampleRMS) {
      responseData = downsampleToRMSPerSecond(filteredData);
      responseRMS = responseData.length > 0 ? {
        accel_x_rms: responseData[0].accel_x_rms,
        accel_y_rms: responseData[0].accel_y_rms,
        accel_z_rms: responseData[0].accel_z_rms,
        wt901_x_rms: responseData[0].wt901_x_rms,
        wt901_y_rms: responseData[0].wt901_y_rms,
        wt901_z_rms: responseData[0].wt901_z_rms,
      } : {
        accel_x_rms: 0, accel_y_rms: 0, accel_z_rms: 0,
        wt901_x_rms: 0, wt901_y_rms: 0, wt901_z_rms: 0
      };
    }

    // SERVER-SIDE CAP: Limit data points to prevent client-side crashes
    // If a date range is provided, allow high resolution up to 3000 pts for zooming. Else 800.
    const MAX_CLIENT_POINTS = startDate && endDate ? 3000 : 800;
    if (responseData.length > MAX_CLIENT_POINTS) {
      const step = Math.ceil(responseData.length / MAX_CLIENT_POINTS);
      responseData = responseData.filter((_: any, i: number) => i % step === 0);
    }

    console.log(`📈 Returning ${responseData.length} REAL data points from last ${minutes} minute(s) (downsampleRMS=${downsampleRMS}, capped=${filteredData.length > MAX_CLIENT_POINTS})`)
    console.log(`📊 Data time range: ${responseData.length > 0 ? new Date(responseData[responseData.length - 1].timestamp).toLocaleString() + ' to ' + new Date(responseData[0].timestamp).toLocaleTimeString() : 'No data'}`)

    return NextResponse.json({
      success: true,
      data: responseData,
      rms: responseRMS,
      metadata: {
        source: dataSource,
        filename: filename,
        totalPoints: allData.length,
        recentPoints: responseData.length,
        timeframe: timeframeDescription,
        samplingRate: samplesPerSecond || 'raw',
        lastUpdate: new Date().toISOString(),
        latestDataTime: responseData[0] ? new Date(responseData[0].timestamp).toLocaleString() : null,
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