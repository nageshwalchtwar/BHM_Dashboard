import { NextResponse, NextRequest } from 'next/server';
import * as deviceConfig from '@/lib/device-config';
import { streamCSVByDateAsRMS } from '@/lib/simple-google-api';

/**
 * Debug endpoint to test "1 Day" data fetching for a specific device
 * Query params: ?device=d1  (defaults to Device 1)
 * Visit: /api/debug-1day-fetch?device=d1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device') || 'd1';  // Default to Device 1
    
    console.log(`🔍 DEBUG: Testing 1-Day fetch for ${deviceId}...`);

    // Step 1: Check if Device exists
    let device = null;
    try {
      device = deviceConfig.getDevice(deviceId);
      console.log(`✅ ${deviceId} found:`, device);
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'get-device',
        error: `${deviceId} not found: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 404 });
    }

    // Step 2: Get folder ID
    let folderId = '';
    try {
      folderId = deviceConfig.getFolderIdForDevice(deviceId);
      console.log(`✅ Folder ID obtained: ${folderId}`);
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'get-folder-id',
        error: `Failed to get folder ID: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 500 });
    }

    // Step 3: Check API key
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const hasApiKey = apiKey && !apiKey.startsWith('your_');
    if (!hasApiKey) {
      return NextResponse.json({
        success: false,
        step: 'check-api-key',
        error: 'GOOGLE_DRIVE_API_KEY is not configured or is a placeholder',
      }, { status: 500 });
    }
    console.log(`✅ API Key configured`);

    // Step 4: Try to fetch data using streamCSVByDateAsRMS
    console.log(`📡 Calling streamCSVByDateAsRMS with folderId=${folderId}`);
    const result = await streamCSVByDateAsRMS('', folderId, 1000);

    if (!result) {
      return NextResponse.json({
        success: false,
        step: 'stream-csv',
        error: 'streamCSVByDateAsRMS returned null - no files found or access denied',
        debug: {
          folderId,
          folderUrl: device?.folderUrl,
          hasApiKey,
        },
      });
    }

    // Step 5: Data successfully fetched
    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        name: device.name,
        folderId,
      },
      result: {
        filename: result.filename,
        modifiedTime: result.modifiedTime,
        rawRowCount: result.rawRowCount,
        rmsDataPoints: result.rmsData.length,
        sampleData: result.rmsData.slice(0, 5),
      },
      message: '✅ 1-Day fetch SUCCESS! Data is available.',
    });
  } catch (err) {
    console.error('❌ DEBUG ERROR:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, { status: 500 });
  }
}
