import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData, getRecentData, getLatestRMSValues, downsampleToRMSPerSecond, streamParseCSVToRMS } from "@/lib/csv-handler"
import { getCSVFromGoogleDrive, getCSVFromGoogleDriveOptimized, getMultipleCSVsFromGoogleDrive, getCSVByDate } from '@/lib/simple-google-api'
import { getFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// ── Response cache ────────────────────────────────────────────────────────
interface ResponseCacheEntry {
  json: any;
  cachedAt: number;
}
const responseCache = new Map<string, ResponseCacheEntry>();

function getCacheTTL(mode: string): number {
  if (mode === 'minute') return 15_000;  // 1 Min → 15s
  if (mode === 'date') return 120_000;   // Single date → 2min (historical, won't change)
  return 120_000;                        // Week → 2min
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const modeParam = searchParams.get("mode") || "minute"
  const mode = ['minute', 'date', 'week'].includes(modeParam) ? modeParam : 'minute' // 'minute' | 'date' | 'week'
  const date = searchParams.get("date") || ""       // YYYY-MM-DD for 'date' mode
  const deviceId = searchParams.get("device")

  // ── Check response cache ─────────────────────────────────────────────
  const cacheKey = `${deviceId || 'default'}:${mode}:${date}`;
  const cached = responseCache.get(cacheKey);
  const ttl = getCacheTTL(mode);
  if (cached && (Date.now() - cached.cachedAt) < ttl) {
    console.log(`⚡ Cache hit for ${cacheKey} (age: ${Date.now() - cached.cachedAt}ms)`);
    return NextResponse.json(cached.json);
  }

  console.log(`📊 API Request: mode=${mode}${date ? `, date=${date}` : ''}, device=${deviceId || 'default'}`)

  try {
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice();
    // Use latestDataFolderId for minute mode, regular folderId for date/week
    const folderId = mode === 'minute' && device?.latestDataFolderId
      ? device.latestDataFolderId
      : getFolderIdForDevice(deviceId || undefined);

    console.log(`📂 Using device=${device?.name || 'unknown'} (${device?.id || 'no-id'}), folderId=${folderId}`)
    console.log(`🔑 API key present: ${!!process.env.GOOGLE_DRIVE_API_KEY}, length: ${process.env.GOOGLE_DRIVE_API_KEY?.length || 0}`)

    let allData: any[] = []
    let dataSource = ''
    let filenames: string[] = []
    let isPreRMS = false; // true when streamParseCSVToRMS was used (skip redundant downsample)

    // Helper: extract date from filename or modifiedTime
    const extractFileDate = (filename: string, modifiedTime?: string): string | undefined => {
      const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
      if (modifiedTime) return modifiedTime.split('T')[0];
      return undefined;
    };

    if (mode === 'week') {
      // ── 1 Week: Fetch last 7 daily files ──────────────────────────────
      console.log('📂 Fetching up to 7 CSV files for 1 Week view...')
      const multiResult = await getMultipleCSVsFromGoogleDrive(7, folderId);

      if (multiResult && multiResult.contents.length > 0) {
        filenames = multiResult.filenames;
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - ${multiResult.contents.length} files`;
        // Use streaming RMS parser per file — avoids huge intermediate arrays
        const rmsWindowMs = 60000; // 60s windows for week mode
        for (let i = 0; i < multiResult.contents.length; i++) {
          const fileDate = extractFileDate(multiResult.filenames[i], multiResult.modifiedTimes[i]);
          console.log(`📅 Streaming-RMS parsing file ${multiResult.filenames[i]} with date: ${fileDate || 'unknown'}`);
          const { rmsData, rawRowCount } = streamParseCSVToRMS(multiResult.contents[i], rmsWindowMs, fileDate);
          allData.push(...rmsData);
          console.log(`   → ${rawRowCount} raw rows → ${rmsData.length} RMS points`);
        }
        console.log(`📈 Merged ${allData.length} RMS points from ${multiResult.contents.length} files`);
        isPreRMS = true;
      }
    } else if (mode === 'date' && date) {
      // ── Select Date: Fetch specific day's file ─────────────────────────
      console.log(`📅 Fetching CSV for date: ${date}`)
      const result = await getCSVByDate(date, folderId);

      if (result && result.content) {
        filenames = [result.filename];
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - ${date}`;
        const fileDate = extractFileDate(result.filename, result.modifiedTime);
        // Use streaming RMS parser — 10s windows for date mode
        const { rmsData, rawRowCount } = streamParseCSVToRMS(result.content, 10000, fileDate);
        allData = rmsData;
        console.log(`📈 Streaming-RMS: ${rawRowCount} raw rows → ${rmsData.length} RMS points from ${result.filename}`);
        isPreRMS = true;
      }
    }

    // ── 1 Min: optimised path — Range download + streaming RMS ──────────
    if (mode === 'minute' && allData.length === 0) {
      console.log('🔐 Fetching latest CSV (1 Min mode — optimised)...')
      const optResult = await getCSVFromGoogleDriveOptimized(folderId);
      if (optResult && optResult.content && optResult.content.length > 100) {
        filenames = [optResult.filename];
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - Latest (optimised)`;
        const fileDate = extractFileDate(optResult.filename, optResult.modifiedTime);

        // Use streaming RMS parser — goes straight from CSV text → RMS data
        // Only keep last 60 seconds for "1 minute" mode
        const { rmsData, rawRowCount, latestRMS } = streamParseCSVToRMS(
          optResult.content,
          1000,       // 1-second RMS windows
          fileDate,
          optResult.header || undefined,
          60,         // only last 60 seconds
        );

        if (rmsData.length > 0) {
          console.log(`⚡ Streaming RMS: ${rawRowCount} raw rows → ${rmsData.length} RMS points (skipped full parse)`);

          // Cap data points
          const MAX_CLIENT_POINTS = 5000;
          let responseData = rmsData;
          if (responseData.length > MAX_CLIENT_POINTS) {
            const step = Math.ceil(responseData.length / MAX_CLIENT_POINTS);
            responseData = responseData.filter((_: any, i: number) => i % step === 0);
          }

          const dataStart = new Date(responseData[0].timestamp);
          const dataEnd = new Date(responseData[responseData.length - 1].timestamp);

          const responseJson = {
            success: true,
            data: responseData,
            rms: latestRMS,
            isRMSData: true,
            metadata: {
              source: dataSource,
              filename: filenames.join(', '),
              totalPoints: rawRowCount,
              rawPoints: rawRowCount,
              rmsPoints: responseData.length,
              timeframe: '1 minute',
              dataSpan: { start: dataStart.toISOString(), end: dataEnd.toISOString(), spanMinutes: 1 },
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
        }
      }

      // Fallback: original full-download path if optimised path failed
      console.log('⬇️ Optimised path unavailable, trying full download...')
      const result = await getCSVFromGoogleDrive(folderId);
      if (result && result.content && result.content.length > 100) {
        filenames = [result.filename];
        dataSource = `Google Drive (${device?.name || 'Real Data'}) - Latest`;
        const fileDate = extractFileDate(result.filename, result.modifiedTime);
        allData = parseCSVToSensorData(result.content, fileDate);
        console.log(`📈 Parsed ${allData.length} data points from ${result.filename}`);
      }
    }

    if (allData.length === 0) {
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      const hasValidKey = apiKey && !apiKey.startsWith('your_');
      let configHint = '';
      if (!hasValidKey) {
        configHint = ' — GOOGLE_DRIVE_API_KEY is not configured.';
      } else if (!folderId) {
        configHint = ' — No folder ID configured for this device.';
      } else {
        configHint = ` — Folder ${folderId} returned no files. This usually means file download failed (files were listed but CSV content could not be downloaded). Check server logs for details, or run the debug endpoint (/api/debug-drive) to diagnose.`;
      }
      console.log(`❌ No data: device=${device?.id}, folder=${folderId}, hasKey=${hasValidKey}${configHint}`)
      return NextResponse.json({
        success: false,
        error: "No CSV data available from Google Drive" + configHint,
        message: mode === 'date'
          ? `No data file found for date: ${date} in selected device folder`
          : mode === 'week'
            ? `No weekly CSV data available for device: ${deviceId || 'default'}`
          : `Could not access CSV files for device: ${deviceId || 'default'}`,
      }, { status: 404 })
    }

    // Sort by timestamp (newest first)
    allData.sort((a, b) => b.timestamp - a.timestamp)

    // Log data span
    const dataStart = new Date(allData[allData.length - 1].timestamp)
    const dataEnd = new Date(allData[0].timestamp)
    const spanMinutes = Math.round((dataEnd.getTime() - dataStart.getTime()) / 60000)
    console.log(`📊 Data span: ${dataStart.toISOString()} → ${dataEnd.toISOString()} (${spanMinutes} min, ${allData.length} points)`)

    let filteredData = allData
    const timeframeDescription = mode === 'week' ? '1 week' : mode === 'date' ? date : '1 minute'

    if (mode === 'minute' && allData.length > 0) {
      const latestTimestamp = allData[0].timestamp
      const cutoffMs = latestTimestamp - (60 * 1000)  // Last 1 minute
      filteredData = allData.filter((d: any) => d.timestamp >= cutoffMs)
      console.log(`⏱️ 1 Min filter: ${allData.length} total → ${filteredData.length} filtered`)
    }

    let responseData: any[];
    let responseRMS: any;
    const isRMSData = true;

    if (isPreRMS) {
      // Data already RMS'd by streamParseCSVToRMS — skip redundant downsample
      responseData = filteredData;
      responseRMS = filteredData.length > 0 ? {
        accel_x_rms: filteredData[0].accel_x ?? 0,
        accel_y_rms: filteredData[0].accel_y ?? 0,
        accel_z_rms: filteredData[0].accel_z ?? 0,
        wt901_x_rms: filteredData[0].ax_wt901 ?? 0,
        wt901_y_rms: filteredData[0].ay_wt901 ?? 0,
        wt901_z_rms: filteredData[0].az_wt901 ?? 0,
      } : getLatestRMSValues([], 100);
      console.log(`⚡ Pre-RMS data: ${filteredData.length} points (no additional downsample)`);
    } else {
      // Calculate latest RMS for the header display (always 1-second window)
      responseRMS = getLatestRMSValues(filteredData, 100);

      // RMS window: minute=1s, date=10s, week=60s
      const rmsWindowMs = mode === 'week' ? 60000 : mode === 'date' ? 10000 : 1000;

      responseData = downsampleToRMSPerSecond(filteredData, rmsWindowMs);
      console.log(`📊 RMS downsampled: ${filteredData.length} raw → ${responseData.length} points (${rmsWindowMs/1000}s windows)`);
    }

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