import { NextResponse, NextRequest } from 'next/server';
import * as deviceConfig from '@/lib/device-config';

/**
 * Debug endpoint to test Google Drive file access for a specific device
 * Query params: ?device=d1  (defaults to Device 1)
 * Tests:
 1. Device configuration
 2. Folder access (listing files)
 3. File download permissions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device') || 'd1';  // Default to Device 1
    
    console.log(`🔍 DEBUG: Testing ${deviceId} Google Drive access...`);

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const hasApiKey = apiKey && !apiKey.startsWith('your_');

    if (!hasApiKey) {
      return NextResponse.json({
        success: false,
        step: 'api-key',
        error: 'GOOGLE_DRIVE_API_KEY not configured or is placeholder',
        solution: 'Set GOOGLE_DRIVE_API_KEY in Railway environment variables',
      }, { status: 500 });
    }

    // Get device
    let device = null;
    try {
      device = deviceConfig.getDevice(deviceId);
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'device-config',
        error: `${deviceId} not found: ${err instanceof Error ? err.message : String(err)}`,
        solution: `Set DEVICE_${deviceId.replace('d', '')}_FOLDER_ID in environment variables`,
      }, { status: 404 });
    }

    const folderId = device.folderId;

    // Test: List files in folder
    console.log(`📂 Testing folder access for ${deviceId}: ${folderId}`);
    
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=trashed=false&pageSize=10&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,size,modifiedTime)&key=${apiKey}&corpora=allDrives&includeItemsFromAllDrives=true`;
    
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();

    if (listData.error) {
      return NextResponse.json({
        success: false,
        step: 'list-files',
        error: `${listData.error.code}: ${listData.error.message}`,
        details: listData.error,
        solution: 'Verify GOOGLE_DRIVE_API_KEY is valid and has Drive API enabled',
      }, { status: 403 });
    }

    if (!listData.files || listData.files.length === 0) {
      return NextResponse.json({
        success: false,
        step: 'find-files',
        error: 'No CSV files found in folder',
        folderId,
        filesFound: 0,
        solution: 'Upload CSV files to the Google Drive folder',
      }, { status: 404 });
    }

    // Find a CSV file for Feb 25
    const csvFiles = listData.files.filter((f: any) => f.name.endsWith('.csv'));
    const feb25File = csvFiles.find((f: any) => f.name.includes('2026-02-25'));
    const testFile = feb25File || csvFiles[0];

    if (!testFile) {
      return NextResponse.json({
        success: false,
        step: 'find-csv',
        error: 'No CSV files found',
        fileCount: listData.files.length,
        files: listData.files.map((f: any) => f.name),
      }, { status: 404 });
    }

    // Test: Try to download the file
    console.log(`📥 Testing download of ${testFile.name} (${testFile.id})`);
    
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${testFile.id}?alt=media&key=${apiKey}`;
    const downloadResponse = await fetch(downloadUrl);

    if (downloadResponse.status === 403) {
      return NextResponse.json({
        success: false,
        step: 'download-file',
        error: '403 Forbidden - File cannot be downloaded',
        fileInfo: {
          name: testFile.name,
          id: testFile.id,
          size: testFile.size,
          mimeType: testFile.mimeType,
        },
        solution: 'Fix: Share the FOLDER (not just files) with "Anyone with the link can view" OR configure OAuth instead of API key',
        troubleshooting: [
          '1. Open Google Drive folder in browser',
          '2. Right-click folder → Share',
          '3. Change to "Anyone with the link"',
          '4. Make sure sharing is ON for the entire folder',
          '5. Test if files inside are accessible via the public share link',
        ],
      }, { status: 403 });
    }

    if (!downloadResponse.ok) {
      return NextResponse.json({
        success: false,
        step: 'download-file',
        error: `HTTP ${downloadResponse.status}: ${downloadResponse.statusText}`,
        fileInfo: {
          name: testFile.name,
          id: testFile.id,
        },
      }, { status: downloadResponse.status });
    }

    // Success! Test download worked
    const content = await downloadResponse.text();
    const lines = content.split('\n');

    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        name: device.name,
        folderId,
      },
      fileFound: {
        name: testFile.name,
        id: testFile.id,
        size: testFile.size,
        modifiedTime: testFile.modifiedTime,
      },
      downloadTest: {
        status: 'SUCCESS',
        contentLength: content.length,
        lineCount: lines.length,
        header: lines[0],
        sampleRow: lines[1],
      },
      message: '✅ File download works! All systems operational.',
    });

  } catch (err) {
    console.error('❌ DEBUG ERROR:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
