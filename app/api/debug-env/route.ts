import { NextResponse } from 'next/server';
import { deviceConfig } from '@/lib/device-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = deviceConfig.getAllDevices();
    const defaultDevice = deviceConfig.getDefaultDevice();
    
    return NextResponse.json({
      success: true,
      environment: {
        hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
        apiKeyLength: process.env.GOOGLE_DRIVE_API_KEY?.length || 0,
        device1FolderId: process.env.DEVICE_1_FOLDER_ID || 'NOT_SET',
        device2FolderId: process.env.DEVICE_2_FOLDER_ID || 'NOT_SET', 
        device3FolderId: process.env.DEVICE_3_FOLDER_ID || 'NOT_SET',
        device1Name: process.env.DEVICE_1_NAME || 'NOT_SET',
        device2Name: process.env.DEVICE_2_NAME || 'NOT_SET',
        device3Name: process.env.DEVICE_3_NAME || 'NOT_SET',
      },
      loadedDevices: {
        count: devices.length,
        devices: devices.map(d => ({
          id: d.id,
          name: d.name,
          folderId: d.folderId,
          description: d.description
        })),
        defaultDevice: defaultDevice ? {
          id: defaultDevice.id,
          name: defaultDevice.name,
          folderId: defaultDevice.folderId
        } : null
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
        device1FolderId: process.env.DEVICE_1_FOLDER_ID || 'NOT_SET',
        device2FolderId: process.env.DEVICE_2_FOLDER_ID || 'NOT_SET',
        device3FolderId: process.env.DEVICE_3_FOLDER_ID || 'NOT_SET',
      }
    }, { status: 500 });
  }
}