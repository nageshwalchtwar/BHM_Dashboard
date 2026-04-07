import { NextResponse } from 'next/server';
import { SimpleGoogleDriveAPI } from '@/lib/simple-google-api';
import * as deviceConfig from '@/lib/device-config';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const hasApiKey = apiKey && !apiKey.startsWith('your_');

    let device1FolderId = '';
    try {
      device1FolderId = deviceConfig.getFolderIdForDevice('d1');
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `Device 1 not found: ${err instanceof Error ? err.message : String(err)}`,
      }, { status: 404 });
    }

    return NextResponse.json({
      setup: {
        hasGoogleDriveApiKey: hasApiKey,
        apiKeyFirstChars: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET',
        device1FolderId,
      },
      message: hasApiKey 
        ? 'API Key configured ✅' 
        : 'API Key NOT configured or is placeholder ❌',
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
