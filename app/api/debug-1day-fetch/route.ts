import { NextResponse } from 'next/server';
import * as deviceConfig from '@/lib/device-config';
import { streamCSVByDateAsRMS } from '@/lib/simple-google-api';

/**
 * Debug endpoint to test "1 Day" mode data fetching for Device 1
 * Visit: /api/debug-1day-fetch
 */
export async function GET() {
  try {
    console.log('🔍 DEBUG: Testing 1-Day fetch for Device 1...');

    // Step 1: Check if Device 1 exists
    let device1 = null;
    try {
      device1 = deviceConfig.getDevice('d1');
      console.log(`✅ Device 1 found:`, device1);
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'get-device',
        error: `Device 1 not found: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 404 });
    }

    // Step 2: Get folder ID
    let folderId = '';
    try {
      folderId = deviceConfig.getFolderIdForDevice('d1');
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
          folderUrl: device1?.folderUrl,
          hasApiKey,
        },
      });
    }

    // Step 5: Data successfully fetched
    return NextResponse.json({
      success: true,
      device: {
        id: device1.id,
        name: device1.name,
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
