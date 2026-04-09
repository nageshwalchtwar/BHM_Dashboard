import { NextRequest, NextResponse } from 'next/server';
import { deviceConfig, extractFolderIdFromUrl } from '@/lib/device-config';
import { getDriveSubfolders } from '@/lib/simple-google-api';

export const dynamic = 'force-dynamic';

let lastAutoDiscoveryAt = 0;
const AUTO_DISCOVERY_TTL_MS = 5 * 60 * 1000;

async function autoDiscoverDevices(parentFolderUrl?: string) {
  const subfolders = await getDriveSubfolders(parentFolderUrl);
  if (subfolders.length === 0) {
    return { discovered: 0, added: 0 };
  }

  // Sort discovered folders alphabetically for stable ordering.
  const candidates = [...subfolders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);

  const existing = deviceConfig.getAllDevices();
  const envDeviceIds = ['d1', 'd2', 'd3', 'd4', 'd5'];
  const envDevices = existing.filter(d => envDeviceIds.includes(d.id));

  // ── If we already have env-configured devices, only UPDATE their folderIds ──
  // Never add new auto-discovered devices when env devices exist.
  if (envDevices.length > 0) {
    let updated = 0;
    for (const candidate of candidates) {
      // Try fuzzy name match first (ignore case, underscores, spaces)
      const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');
      let match = envDevices.find(d => norm(d.name) === norm(candidate.name));

      // Fallback: positional match (sorted auto-discovered → d1, d2, d3, d4, d5)
      if (!match) {
        const idx = candidates.indexOf(candidate);
        if (idx < envDevices.length) {
          match = envDevices[idx];
        }
      }

      if (match) {
        deviceConfig.updateDeviceFolder(match.id, candidate.folderId);
        updated++;
      }
    }
    return { discovered: candidates.length, added: 0, updated };
  }

  // ── No env devices — add auto-discovered devices as before ──
  let added = 0;
  for (let i = 0; i < candidates.length; i++) {
    const folder = candidates[i];
    const existingDevice = existing.find((device) => device.folderId === folder.id);
    if (existingDevice) continue;

    try {
      const created = deviceConfig.addDevice(
        folder.name,
        folder.folderUrl,
        `Auto-discovered slot ${i + 1}: ${folder.name}`
      );
      if (created) added++;
    } catch {
      // Skip folders that are duplicates or invalid.
    }
  }

  if (!deviceConfig.getDefaultDevice()) {
    const updated = deviceConfig.getAllDevices();
    if (updated[0]) {
      deviceConfig.setDefaultDevice(updated[0].id);
    }
  }

  return { discovered: candidates.length, added };
}

// GET - List all devices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceDiscover = searchParams.get('discover') === 'true';
    const parentFolderUrl = searchParams.get('parentFolderUrl') || undefined;

    const now = Date.now();
    const shouldAutoDiscover = forceDiscover || now - lastAutoDiscoveryAt > AUTO_DISCOVERY_TTL_MS;
    let discoveryResult = { discovered: 0, added: 0 };
    if (shouldAutoDiscover) {
      discoveryResult = await autoDiscoverDevices(parentFolderUrl);
      lastAutoDiscoveryAt = now;
    }

    // Clean up: remove any stale auto-discovered devices if env devices exist.
    const allDevices = deviceConfig.getAllDevices();
    const envDeviceIds = ['d1', 'd2', 'd3', 'd4', 'd5'];
    const envDevices = allDevices.filter(d => envDeviceIds.includes(d.id));
    if (envDevices.length > 0) {
      for (const d of allDevices) {
        if (!envDeviceIds.includes(d.id)) {
          deviceConfig.removeDevice(d.id);
        }
      }
    }

    const devices = deviceConfig.getAllDevices();
    const defaultDevice = deviceConfig.getDefaultDevice();
    const stats = deviceConfig.getStats();

    return NextResponse.json({
      success: true,
      devices,
      defaultDevice,
      stats,
      autoDiscovery: discoveryResult
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
    if (body?.action === 'autodiscover') {
      const discoveryResult = await autoDiscoverDevices(body?.parentFolderUrl);
      const devices = deviceConfig.getAllDevices();
      const defaultDevice = deviceConfig.getDefaultDevice();
      const stats = deviceConfig.getStats();

      return NextResponse.json({
        success: true,
        message: `Auto-discovery completed (${discoveryResult.added} added, ${discoveryResult.discovered} found)`,
        autoDiscovery: discoveryResult,
        devices,
        defaultDevice,
        stats
      });
    }

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