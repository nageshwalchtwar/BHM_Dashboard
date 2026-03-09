import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData, getLatestRMSValues, downsampleToRMSPerSecond } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive, getMultipleCSVsFromGoogleDrive } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// ── Response cache ────────────────────────────────────────────────────────
// Caches the full JSON response per (device, minutes, range) to avoid
// re-downloading & re-processing on rapid repeated requests.
interface ResponseCacheEntry {
  json: any;
  cachedAt: number;
}
const responseCache = new Map<string, ResponseCacheEntry>();

// TTL per range: shorter for live/1min, longer for historical
function getCacheTTL(minutes: number): number {
  if (minutes <= 1) return 15_000;    // 1 min → 15s cache
  if (minutes <= 60) return 30_000;   // 1 hour → 30s cache
  if (minutes <= 1440) return 60_000; // 1 day → 60s cache
  return 120_000;                     // 1 week → 2min cache
}

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
  const startDate = searchParams.get("startDate") // ISO date string for custom range
  const endDate = searchParams.get("endDate")     // ISO date string for custom range

  const isCustomRange = !!(startDate && endDate)

  // ── Check response cache ─────────────────────────────────────────────
  const cacheKey = `${deviceId || 'default'}:${minutes}:${startDate || ''}:${endDate || ''}`;
  const cached = responseCache.get(cacheKey);
  const ttl = getCacheTTL(minutes);
  if (cached && (Date.now() - cached.cachedAt) < ttl) {
    console.log(`⚡ Cache hit for ${cacheKey} (age: ${Date.now() - cached.cachedAt}ms)`);
    return NextResponse.json(cached.json);
  }

  console.log(`📊 API Request: minutes=${minutes}, device=${deviceId || 'default'}${isCustomRange ? `, range: ${startDate} to ${endDate}` : ''}`)

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

    // Determine how many files to fetch based on requested range
    // Each file in Drive = 1 full day of merged data.
    // So: ≤1 day needs just the latest file, 1 week needs ~7, custom based on date span.
    const shouldFetchMultiple = isCustomRange || minutes >= 10080
    const maxFiles = isCustomRange
      ? Math.min(Math.ceil((new Date(endDate!).getTime() - new Date(startDate!).getTime()) / 86400000) + 1, 30)
      : minutes >= 10080
        ? 7   // 1 week: ~7 daily files
        : 1   // 1 min / 1 hour / 1 day: single latest file

    // Use sinceDate for week & custom to filter at Drive level
    let sinceDate: string | undefined
    if (isCustomRange && startDate) {
      sinceDate = new Date(startDate).toISOString()
    } else if (minutes >= 10080) {
      sinceDate = new Date(Date.now() - minutes * 60 * 1000).toISOString()
    }

    if (shouldFetchMultiple) {
      console.log(`📂 Fetching up to ${maxFiles} CSV files for ${isCustomRange ? 'custom range' : `${minutes}-min range`}${sinceDate ? ` (since ${sinceDate})` : ''}...`)
      const multiResult = await getMultipleCSVsFromGoogleDrive(maxFiles, folderId, sinceDate);

      if (multiResult && multiResult.contents.length > 0) {
        filenames = multiResult.filenames;
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - ${multiResult.contents.length} files`;
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

    // Sort by timestamp (newest first)
    allData.sort((a, b) => b.timestamp - a.timestamp)

    // Log actual data time span for debugging
    const dataStart = new Date(allData[allData.length - 1].timestamp)
    const dataEnd = new Date(allData[0].timestamp)
    const spanMinutes = Math.round((dataEnd.getTime() - dataStart.getTime()) / 60000)
    console.log(`📊 Data span: ${dataStart.toISOString()} → ${dataEnd.toISOString()} (${spanMinutes} min, ${allData.length} points)`)

    // Apply time filtering based on mode
    let filteredData: any[]
    let timeframeDescription: string

    if (isCustomRange) {
      // Custom date range: filter between startDate and endDate
      const rangeStart = new Date(startDate!).getTime()
      const rangeEnd = new Date(endDate!).getTime() + 86400000 // Include the end date fully
      filteredData = allData.filter((d: any) => d.timestamp >= rangeStart && d.timestamp <= rangeEnd)
      timeframeDescription = `${startDate} to ${endDate}`
    } else if (minutes >= 1440) {
      // For 1 Day / 1 Week: return ALL data from fetched files (no time cutoff)
      // The number of files fetched already represents the time range
      filteredData = allData
      timeframeDescription = minutes >= 10080 ? '1 week' : '1 day'
    } else {
      // For 1 Min / 1 Hour: apply time cutoff from the latest data point
      const now = allData[0].timestamp
      const cutoffMs = now - (minutes * 60 * 1000)
      filteredData = allData.filter((d: any) => d.timestamp >= cutoffMs)
      timeframeDescription = minutes >= 60 ? '1 hour' : `${minutes} min`
    }

    console.log(`⏱️ Time filter (${timeframeDescription}): ${allData.length} total → ${filteredData.length} filtered`)

    // Calculate latest RMS for the header display (always 1-second window)
    const responseRMS = getLatestRMSValues(filteredData, 100);

    // Adaptive RMS window: 1s for short ranges, larger for longer ranges
    // This keeps chart points manageable (~3600 max) regardless of time range
    const rmsWindowMs = minutes >= 10080
      ? 60000   // 1 week → 60-second windows (~10080 points)
      : minutes >= 1440
        ? 10000  // 1 day → 10-second windows (~8640 points)
        : 1000   // 1 min / 1 hour → 1-second windows (~3600 points)

    let responseData = downsampleToRMSPerSecond(filteredData, rmsWindowMs);
    const isRMSData = true;
    console.log(`📊 RMS downsampled: ${filteredData.length} raw → ${responseData.length} points (${rmsWindowMs/1000}s windows)`);

    // Cap data points to prevent client crashes
    const MAX_CLIENT_POINTS = 5000;
    if (responseData.length > MAX_CLIENT_POINTS) {
      const step = Math.ceil(responseData.length / MAX_CLIENT_POINTS);
      responseData = responseData.filter((_: any, i: number) => i % step === 0);
      console.log(`📉 Capped to ${responseData.length} points (step: ${step})`)
    }

    console.log(`📈 Returning ${responseData.length} RMS points for ${timeframeDescription}`)

    const responseJson = {
      success: true,
      data: responseData,
      rms: responseRMS,
      isRMSData,
      metadata: {
        source: dataSource,
        filename: filenames.join(', '),
        totalPoints: allData.length,
        rawPoints: filteredData.length,
        rmsPoints: responseData.length,
        timeframe: timeframeDescription,
        dataSpan: { start: dataStart.toISOString(), end: dataEnd.toISOString(), spanMinutes },
        isRMSData,
        lastUpdate: new Date().toISOString(),
        latestDataTime: responseData[0] ? new Date(responseData[0].timestamp).toISOString() : null,
        oldestDataTime: responseData.length > 0 ? new Date(responseData[responseData.length - 1].timestamp).toISOString() : null,
        isRealData: true,
        device: device ? {
          id: device.id,
          name: device.name,
          description: device.description,
          folderUrl: device.folderUrl
        } : null
      }
    }

    // Store in response cache
    responseCache.set(cacheKey, { json: responseJson, cachedAt: Date.now() });

    return NextResponse.json(responseJson)

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