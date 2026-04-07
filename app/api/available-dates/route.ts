import { NextResponse } from 'next/server';
import * as deviceConfig from '@/lib/device-config';
import { SimpleGoogleDriveAPI } from '@/lib/simple-google-api';

/**
 * Get available dates from CSV files in Device_S folder
 * Returns list of dates extracted from filenames like: MERGED_2026-02-25_S_10s_rms.csv
 */
export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_DRIVE_API_KEY not configured',
        dates: [],
      }, { status: 500 });
    }

    // Get Device_S folder ID
    let deviceS = null;
    try {
      deviceS = deviceConfig.getDevice('Device_S');
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `Device_S not found: ${err instanceof Error ? err.message : String(err)}`,
        dates: [],
      }, { status: 404 });
    }

    const folderId = deviceS.folderId;
    const api = new SimpleGoogleDriveAPI(folderId, apiKey);

    // List all CSV files in the folder
    const files = await api.listFilesWithAPIKey();
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        dates: [],
        message: 'No files found in folder',
      });
    }

    // Extract dates from filenames: MERGED_2026-02-25_S_10s_rms.csv
    const dateSet = new Set<string>();
    
    files.forEach((file) => {
      // Look for pattern: YYYY-MM-DD
      const match = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (match && match[1]) {
        dateSet.add(match[1]);
      }
    });

    // Convert to array and sort newest first
    const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    return NextResponse.json({
      success: true,
      dates,
      count: dates.length,
      message: `Found ${dates.length} available dates`,
      sampleDates: dates.slice(0, 5),
      allFiles: files.map(f => ({ name: f.name, date: f.name.match(/(\d{4}-\d{2}-\d{2})/) ? f.name.match(/(\d{4}-\d{2}-\d{2})/)![1] : 'unknown' })),
    });

  } catch (err) {
    console.error('❌ Error fetching available dates:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      dates: [],
    }, { status: 500 });
  }
}
