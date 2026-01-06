import { NextResponse } from 'next/server';
import { deviceConfig } from '@/lib/device-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = deviceConfig.getAllDevices();
    const defaultDevice = deviceConfig.getDefaultDevice();
    const stats = deviceConfig.getStats();
    
    // Check environment variables
    const envCheck = {
      DEVICE_1_FOLDER_ID: process.env.DEVICE_1_FOLDER_ID || 'NOT_SET',
      DEVICE_2_FOLDER_ID: process.env.DEVICE_2_FOLDER_ID || 'NOT_SET',
      DEVICE_3_FOLDER_ID: process.env.DEVICE_3_FOLDER_ID || 'NOT_SET',
      GOOGLE_DRIVE_API_KEY: process.env.GOOGLE_DRIVE_API_KEY ? 'SET' : 'NOT_SET'
    };

    return NextResponse.json({
      success: true,
      envVariables: envCheck,
      devices,
      defaultDevice,
      stats,
      message: devices.length > 0 ? 
        `Found ${devices.length} devices configured` : 
        'No devices found - check Railway environment variables'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to check device config',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}