import { NextRequest, NextResponse } from 'next/server';
import { deviceConfig, extractFolderIdFromUrl } from '@/lib/device-config';

export const dynamic = 'force-dynamic';

// GET - List all devices
export async function GET() {
  try {
    const devices = deviceConfig.getAllDevices();
    const defaultDevice = deviceConfig.getDefaultDevice();
    const stats = deviceConfig.getStats();

    return NextResponse.json({
      success: true,
      devices,
      defaultDevice,
      stats
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Add new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, folderUrl, description, setAsDefault } = body;

    if (!name || !folderUrl) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Device name and folder URL are required'
      }, { status: 400 });
    }

    // Validate folder URL
    const folderId = extractFolderIdFromUrl(folderUrl);
    if (!folderId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid folder URL',
        message: 'Please provide a valid Google Drive folder URL'
      }, { status: 400 });
    }

    const newDevice = deviceConfig.addDevice(name, folderUrl, description);
    
    if (setAsDefault && newDevice) {
      deviceConfig.setDefaultDevice(newDevice.id);
    }

    return NextResponse.json({
      success: true,
      device: newDevice,
      message: 'Device added successfully'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to add device',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT - Update device or set default
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, setAsDefault, name, description } = body;

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing device ID',
        message: 'Device ID is required'
      }, { status: 400 });
    }

    const device = deviceConfig.getDevice(deviceId);
    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Device not found',
        message: `Device with ID ${deviceId} not found`
      }, { status: 404 });
    }

    // Update device properties if provided
    if (name) device.name = name;
    if (description !== undefined) device.description = description;

    // Set as default if requested
    if (setAsDefault) {
      deviceConfig.setDefaultDevice(deviceId);
    }

    return NextResponse.json({
      success: true,
      device,
      message: 'Device updated successfully'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to update device',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Remove device
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing device ID',
        message: 'Device ID is required'
      }, { status: 400 });
    }

    const success = deviceConfig.removeDevice(deviceId);
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Device not found',
        message: `Device with ID ${deviceId} not found`
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device removed successfully'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to remove device',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}