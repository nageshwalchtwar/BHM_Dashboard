import { NextResponse } from 'next/server';
import * as deviceConfig from '@/lib/device-config';

export async function GET() {
  try {
    // Get all loaded devices
    const allDevices = deviceConfig.getAllDevices();
    
    // Try to get Device 1 specifically
    let device1 = null;
    let device1FolderId = null;
    try {
      device1 = deviceConfig.getDevice('d1');
      device1FolderId = deviceConfig.getFolderIdForDevice('d1');
    } catch (err) {
      console.log('Error getting Device 1:', err);
    }

    // Check environment variables directly
    const device1EnvFolderId = process.env.DEVICE_1_FOLDER_ID || '[NOT SET]';
    const device1EnvName = process.env.DEVICE_1_NAME || '[NOT SET]';

    return NextResponse.json({
      success: true,
      devices: {
        all: allDevices.map(d => ({
          id: d.id,
          name: d.name,
          folderId: d.folderId,
          latestDataFolderId: d.latestDataFolderId,
        })),
        device_1_specific: device1 ? {
          id: device1.id,
          name: device1.name,
          folderId: device1.folderId,
          latestDataFolderId: device1.latestDataFolderId,
        } : null,
      },
      folderIds: {
        fromGetFolderIdForDevice: device1FolderId,
        fromEnvironment: {
          DEVICE_1_FOLDER_ID: device1EnvFolderId,
          DEVICE_1_NAME: device1EnvName,
        },
      },
      message: device1 ? 'Device 1 found ✅' : 'Device 1 NOT found ❌',
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
