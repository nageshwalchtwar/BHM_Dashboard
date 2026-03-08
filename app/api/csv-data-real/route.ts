import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData, getLatestRMSValues, downsampleToRMSPerSecond } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive, getMultipleCSVsFromGoogleDrive } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// Get the latest CSV file using Google Drive API with device support
async function getLatestRealCSV(minutes = 60, deviceId?: string): Promise<{ filename: string, content: string, modifiedTime?: string, device?: any } | null> {
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
  const minutes = parseInt(searchParams.get("minutes") || "1")
  const deviceId = searchParams.get("device")

  console.log(`📊 API Request: minutes=${minutes}, device=${deviceId || 'default'}`)

  try {
    const folderId = getFolderIdForDevice(deviceId || undefined);
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice();

    let allData: any[] = []
    let dataSource = ''
    let filenames: string[] = []

    // Helper: extract date from filename (e.g., "data_2026-03-08.csv" → "2026-03-08")
    // or from modifiedTime (ISO string from Google Drive)
    const extractFileDate = (filename: string, modifiedTime?: string): string | undefined => {
      // Try filename first (e.g., "2026-03-08" pattern)
      const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
      // Fall back to modifiedTime from Google Drive
      if (modifiedTime) return modifiedTime.split('T')[0];
      return undefined;
    };

    // For longer ranges (>60 min = 1 hour), try fetching multiple CSV files
    if (minutes > 60) {
      const maxFiles = minutes > 1440 ? 7 : 2; // week=7 files, day=2 files
      console.log(`📂 Fetching up to ${maxFiles} CSV files for ${minutes}-min range...`)
      const multiResult = await getMultipleCSVsFromGoogleDrive(maxFiles, folderId);

      if (multiResult && multiResult.contents.length > 0) {
        filenames = multiResult.filenames;
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - ${multiResult.contents.length} files`;
        // Parse and merge all CSV files, passing each file's date for correct timestamps
        for (let i = 0; i < multiResult.contents.length; i++) {
          const fileDate = extractFileDate(multiResult.filenames[i], multiResult.modifiedTimes[i]);
          console.log(`📅 Parsing file ${multiResult.filenames[i]} with date: ${fileDate || 'unknown'}`);
          const parsed = parseCSVToSensorData(multiResult.contents[i], fileDate);
          allData.push(...parsed);
        }
        console.log(`📈 Merged ${allData.length} data points from ${multiResult.contents.length} files`);
      }
    }

    // Fallback or short range: fetch single latest CSV
    if (allData.length === 0) {
      const result = await getLatestRealCSV(minutes, deviceId || undefined);
      if (result && result.content) {
        filenames = [result.filename];
        dataSource = `Google Drive (${device?.name || 'Real Data'})`;
        const fileDate = extractFileDate(result.filename, result.modifiedTime);
        allData = parseCSVToSensorData(result.content, fileDate);
        console.log(`📈 Parsed ${allData.length} data points from ${result.filename} (date: ${fileDate || 'today'})`);
      }
    }

    if (allData.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No real CSV data available from Google Drive",
        message: `Could not access CSV files from Google Drive for device: ${deviceId || 'default'}`,
      }, { status: 404 })
    }

    // Sort by timestamp (newest first) and deduplicate by timestamp
    allData.sort((a, b) => b.timestamp - a.timestamp)
    const seen = new Set<number>();
    allData = allData.filter((d: any) => {
      if (seen.has(d.timestamp)) return false;
      seen.add(d.timestamp);
      return true;
    });

    // Filter to requested time window
    const now = allData[0].timestamp; // Latest data timestamp
    const cutoffMs = now - (minutes * 60 * 1000);
    let filteredData = allData.filter((d: any) => d.timestamp >= cutoffMs);
    const timeframeDescription = minutes >= 10080 ? '1 week' : minutes >= 1440 ? '1 day' : minutes >= 60 ? '1 hour' : `${minutes} min`;

    console.log(`⏱️ Time filter: ${filteredData.length} points in last ${timeframeDescription}`);

    // Calculate latest RMS for the header display
    const responseRMS = getLatestRMSValues(filteredData, 100);

    // Always apply 1-second RMS windowing (100 samples → 1 RMS value per second)
    let responseData = downsampleToRMSPerSecond(filteredData);
    const isRMSData = true;
    console.log(`📊 RMS downsampled: ${filteredData.length} raw → ${responseData.length} RMS points (1-sec windows)`);

    // Cap data points to prevent client crashes
    const MAX_CLIENT_POINTS = 5000;
    if (responseData.length > MAX_CLIENT_POINTS) {
      const step = Math.ceil(responseData.length / MAX_CLIENT_POINTS);
      responseData = responseData.filter((_: any, i: number) => i % step === 0);
    }

    console.log(`📈 Returning ${responseData.length} RMS points for last ${timeframeDescription}`)

    return NextResponse.json({
      success: true,
      data: responseData,
      rms: responseRMS,
      isRMSData,
      metadata: {
        source: dataSource,
        filename: filenames.join(', '),
        totalPoints: allData.length,
        rawPoints: filteredData.length,
        recentPoints: responseData.length,
        timeframe: timeframeDescription,
        isRMSData,
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