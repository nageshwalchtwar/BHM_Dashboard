import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, streamParseCSVToRMS } from "@/lib/csv-handler"
import { getMultipleCSVsFromGoogleDrive, getCSVByDate } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// ── Response cache (2 min) ────────────────────────────────────────────────
const responseCache = new Map<string, { json: any; cachedAt: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const modeParam = searchParams.get("mode") || "date"
  const mode = modeParam === 'week' ? 'week' : 'date'   // only 'date' or 'week'
  const date = searchParams.get("date") || ""
  const deviceId = searchParams.get("device")

  // ── Check response cache ─────────────────────────────────────────────
  const cacheKey = `${deviceId || 'default'}:${mode}:${date}`;
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < 120_000) {
    console.log(`⚡ Cache hit for ${cacheKey}`);
    return NextResponse.json(cached.json);
  }

  console.log(`📊 API: mode=${mode}, date=${date || 'latest'}, device=${deviceId || 'default'}`)

  try {
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice();
    const folderId = getFolderIdForDevice(deviceId || undefined);

    console.log(`📂 Device=${device?.name || 'unknown'}, folderId=${folderId}`)

    let allData: any[] = []
    let dataSource = ''
    let filenames: string[] = []

    // Helper: extract date from filename or modifiedTime
    const extractFileDate = (filename: string, modifiedTime?: string): string | undefined => {
      const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      if (modifiedTime) return modifiedTime.split('T')[0];
      return undefined;
    };

    if (mode === 'date') {
      // ── 1 Day: Download full CSV → 1-second RMS ─────────────────────────
      const targetDate = date || '';
      console.log(`📅 Fetching CSV for date: ${targetDate || 'latest'}`)
      const result = await getCSVByDate(targetDate, folderId);

      if (result && result.content && result.content.length > 100) {
        filenames = [result.filename];
        dataSource = `${device?.name || 'Drive'} - ${result.filename}`;
        const fileDate = extractFileDate(result.filename, result.modifiedTime);

        // 1-second RMS windows — processes line by line, no huge intermediate array
        const { rmsData, rawRowCount } = streamParseCSVToRMS(result.content, 1000, fileDate);
        allData = rmsData;
        console.log(`📈 ${rawRowCount} raw rows → ${rmsData.length} RMS points (1s windows)`);
      }
    } else {
      // ── 1 Week: Download up to 7 CSV files → 1-second RMS each ──────────
      console.log('📂 Fetching up to 7 CSV files for week view...')
      const multiResult = await getMultipleCSVsFromGoogleDrive(7, folderId);

      if (multiResult && multiResult.contents.length > 0) {
        filenames = multiResult.filenames;
        dataSource = `${device?.name || 'Drive'} - ${multiResult.contents.length} files`;

        for (let i = 0; i < multiResult.contents.length; i++) {
          const fileDate = extractFileDate(multiResult.filenames[i], multiResult.modifiedTimes[i]);
          // 10s RMS windows for week — keeps point count manageable across 7 days
          const { rmsData, rawRowCount } = streamParseCSVToRMS(multiResult.contents[i], 10000, fileDate);
          allData.push(...rmsData);
          console.log(`  ${multiResult.filenames[i]}: ${rawRowCount} rows → ${rmsData.length} RMS (10s)`);
        }
        console.log(`📈 Total: ${allData.length} RMS points from ${multiResult.contents.length} files`);
      }
    }

    // ── No data? Return clear error ──────────────────────────────────────
    if (allData.length === 0) {
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      const hasKey = apiKey && !apiKey.startsWith('your_');
      const hint = !hasKey
        ? 'GOOGLE_DRIVE_API_KEY is not configured.'
        : !folderId
          ? 'No folder ID configured for this device.'
          : `Could not download CSV files from folder. Check server logs or /api/debug-drive.`;
      console.log(`❌ No data: folder=${folderId}, hasKey=${hasKey}`)
      return NextResponse.json({
        success: false,
        error: hint,
        message: mode === 'date'
          ? `No data found for date: ${date || 'latest'}`
          : `No weekly data available for device: ${deviceId || 'default'}`,
      }, { status: 404 })
    }

    // Sort ascending by timestamp
    allData.sort((a, b) => a.timestamp - b.timestamp);

    const dataStart = new Date(allData[0].timestamp);
    const dataEnd = new Date(allData[allData.length - 1].timestamp);
    const spanMinutes = Math.round((dataEnd.getTime() - dataStart.getTime()) / 60000);

    // Cap data to prevent client crashes — keep evenly-spaced points
    const MAX_POINTS = 5000;
    let responseData = allData;
    if (responseData.length > MAX_POINTS) {
      const step = Math.ceil(responseData.length / MAX_POINTS);
      responseData = responseData.filter((_: any, i: number) => i % step === 0);
      console.log(`📉 Capped ${allData.length} → ${responseData.length} points`);
    }

    // Latest RMS for header display
    const last = responseData[responseData.length - 1];
    const responseRMS = {
      accel_x_rms: last?.accel_x ?? 0,
      accel_y_rms: last?.accel_y ?? 0,
      accel_z_rms: last?.accel_z ?? 0,
      wt901_x_rms: last?.ax_wt901 ?? 0,
      wt901_y_rms: last?.ay_wt901 ?? 0,
      wt901_z_rms: last?.az_wt901 ?? 0,
    };

    const timeframeDescription = mode === 'week' ? '1 week' : date || 'latest';

    const responseJson = {
      success: true,
      data: responseData,
      rms: responseRMS,
      isRMSData: true,
      metadata: {
        source: dataSource,
        filename: filenames.join(', '),
        totalPoints: allData.length,
        rawPoints: allData.length,
        rmsPoints: responseData.length,
        timeframe: timeframeDescription,
        dataSpan: { start: dataStart.toISOString(), end: dataEnd.toISOString(), spanMinutes },
        isRMSData: true,
        lastUpdate: new Date().toISOString(),
        latestDataTime: dataEnd.toISOString(),
        oldestDataTime: dataStart.toISOString(),
        isRealData: true,
        device: device ? { id: device.id, name: device.name, description: device.description, folderUrl: device.folderUrl } : null
      }
    };

    responseCache.set(cacheKey, { json: responseJson, cachedAt: Date.now() });
    return NextResponse.json(responseJson);

  } catch (error) {
    console.error('❌ CSV data error:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to get CSV data",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST for backward compatibility
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { csvContent } = body
    if (!csvContent) {
      return NextResponse.json({ success: false, error: "No CSV content provided" }, { status: 400 })
    }
    const data = parseCSVToSensorData(csvContent)
    return NextResponse.json({
      success: true,
      data,
      metadata: { source: 'User Provided', filename: 'upload.csv', totalPoints: data.length, lastUpdate: new Date().toISOString() }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to process CSV",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}