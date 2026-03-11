import { NextRequest, NextResponse } from "next/server"
import { parseCSVToSensorData } from "@/lib/csv-handler"
import { streamCSVByDateAsSampled, getCSVBatchTail } from '@/lib/simple-google-api'
import { getFolderIdForDevice, getLatestFolderIdForDevice, deviceConfig } from '@/lib/device-config'

// ── Response cache (2 min for historical, 15s for live) ───────────────────
const responseCache = new Map<string, { json: any; cachedAt: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const modeParam = searchParams.get("mode") || "date"
  const mode = (['1min', '5min'].includes(modeParam) ? modeParam : 'date') as '1min' | '5min' | 'date'
  const date = searchParams.get("date") || ""
  const deviceId = searchParams.get("device")

  const isLive = mode === '1min' || mode === '5min'
  const cacheTTL = isLive ? 15_000 : 120_000  // 15s for live, 2min for historical

  // ── Check response cache ─────────────────────────────────────────────
  const cacheKey = `${deviceId || 'default'}:${mode}:${date}`;
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < cacheTTL) {
    console.log(`⚡ Cache hit for ${cacheKey}`);
    return NextResponse.json(cached.json);
  }

  console.log(`📊 API: mode=${mode}, date=${date || 'latest'}, device=${deviceId || 'default'}`)

  try {
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice();

    let allData: any[] = []
    let dataSource = ''
    let filenames: string[] = []

    if (isLive) {
      // ── Live (1 min / 5 min): latest file from latestDataFolderId ──
      let liveFolderId: string;
      try {
        liveFolderId = getLatestFolderIdForDevice(deviceId || undefined);
      } catch {
        return NextResponse.json({
          success: false,
          error: `No live-data folder configured for ${device?.name || 'this device'}. Set DEVICE_N_LATEST_FOLDER_ID in Railway.`,
        }, { status: 404 });
      }

      console.log(`📂 Live mode: device=${device?.name || 'unknown'}, liveFolderId=${liveFolderId}`);

      // Download tail of the latest CSV from the live folder (last 512KB is plenty for 5 min @ 1 sample/sec)
      const result = await getCSVBatchTail(liveFolderId, 20000);
      if (!result || !result.content) {
        return NextResponse.json({
          success: false,
          error: `No live data found in folder for ${device?.name || 'device'}`,
        }, { status: 404 });
      }

      filenames = [result.filename];
      dataSource = `${device?.name || 'Drive'} - ${result.filename} (live)`;

      // Parse CSV content
      const parsedData = parseCSVToSensorData(result.content);
      if (parsedData.length === 0) {
        return NextResponse.json({ success: false, error: 'Live CSV returned no parseable rows' }, { status: 404 });
      }

      // Filter to only the last N minutes
      const windowMs = mode === '1min' ? 60_000 : 300_000;
      const latestTs = parsedData[parsedData.length - 1].timestamp;
      const cutoff = latestTs - windowMs;
      allData = parsedData.filter((row: any) => row.timestamp >= cutoff);

      console.log(`📈 Live: ${parsedData.length} parsed → ${allData.length} rows in last ${mode === '1min' ? '1' : '5'} min`);

    } else {
      // ── Historical (date) — try both folders with multiple strategies ──
      if (mode === 'date') {
        let result = null;

        // Strategy 1: Try merged folder first (has properly named date CSVs)
        const folderId = getFolderIdForDevice(deviceId || undefined);
        console.log(`📂 [1] Device=${device?.name || 'unknown'}, trying merged folder=${folderId}`);
        result = await streamCSVByDateAsSampled(date || '', folderId, 1000);

        // Strategy 2: Fallback to LATEST folder (has Google Sheets, uses Sheets API/export)
        if (!result) {
          try {
            const latestFolderId = getLatestFolderIdForDevice(deviceId || undefined);
            console.log(`📂 [2] Device=${device?.name || 'unknown'}, trying LATEST folder=${latestFolderId}`);
            result = await streamCSVByDateAsSampled(date || '', latestFolderId, 1000);
          } catch {
            console.log('⚠️ No LATEST folder configured');
          }
        }

        if (result) {
          filenames = [result.filename];
          dataSource = `${device?.name || 'Drive'} - ${result.filename}`;
          allData = result.sampledData;
          console.log(`📈 ${result.rawRowCount} raw rows → ${result.sampledData.length} sample points (1/sec)`);
        }
      }
    }

    // ── No data? Return clear error ──────────────────────────────────────
    if (allData.length === 0) {
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      const hasKey = apiKey && !apiKey.startsWith('your_');
      const hint = !hasKey
        ? 'GOOGLE_DRIVE_API_KEY is not configured.'
        : `Files found but download blocked (403). Ensure files are shared as "Anyone with the link can view" and Google Sheets API is enabled in Cloud Console.`;
      console.log(`❌ No data: hasKey=${hasKey}`)
      const modeMessages: Record<string, string> = {
        '1min': 'No live data (last 1 min)',
        '5min': 'No live data (last 5 min)',
        'date': `No data found for date: ${date || 'latest'}`,
      };
      return NextResponse.json({
        success: false,
        error: hint,
        message: modeMessages[mode] || 'No data',
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

    const timeframeDescription = ({ '1min': 'last 1 minute', '5min': 'last 5 minutes' } as Record<string, string>)[mode] || date || 'latest';

    const responseJson = {
      success: true,
      data: responseData,
      rms: responseRMS,
      isRMSData: false,
      metadata: {
        source: dataSource,
        filename: filenames.join(', '),
        totalPoints: allData.length,
        rawPoints: allData.length,
        rmsPoints: responseData.length,
        timeframe: timeframeDescription,
        dataSpan: { start: dataStart.toISOString(), end: dataEnd.toISOString(), spanMinutes },
        isRMSData: false,
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