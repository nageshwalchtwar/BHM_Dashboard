// Device configuration system for multi-device support
export interface Device {
  id: string;
  name: string;
  description?: string;
  folderId: string;
  folderUrl: string;
  latestDataFolderId?: string;  // Optional separate folder for latest/live data
  latestDataFolderUrl?: string;
  isActive: boolean;
  addedAt: Date;
  lastAccessed?: Date;
}

export interface DeviceConfig {
  devices: Device[];
  defaultDeviceId?: string;
}

// Extract folder ID from Google Drive URL
export function extractFolderIdFromUrl(url: string): string | null {
  // Handle different Google Drive URL formats
  const patterns = [
    // https://drive.google.com/drive/folders/FOLDER_ID
    /\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    // https://drive.google.com/open?id=FOLDER_ID
    /[?&]id=([a-zA-Z0-9_-]+)/,
    // Direct folder ID
    /^[a-zA-Z0-9_-]{25,}$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

// Convert folder ID to full URL
export function folderIdToUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true;
  return value.startsWith('your_') || value.includes('_here');
}

// Get devices from environment variables
function getDevicesFromEnv(): Device[] {
  const devices: Device[] = [];
  
  // Build devices 1-4 from env vars.
  // A device is created if EITHER DEVICE_N_FOLDER_ID or DEVICE_N_LATEST_FOLDER_ID is set.
  for (let n = 1; n <= 4; n++) {
    const folderId = process.env[`DEVICE_${n}_FOLDER_ID`] || '';
    const latestFolderId = process.env[`DEVICE_${n}_LATEST_FOLDER_ID`] || '';
    const hasFolderId = folderId && !isPlaceholderValue(folderId);
    const hasLatestFolderId = latestFolderId && !isPlaceholderValue(latestFolderId);

    if (!hasFolderId && !hasLatestFolderId) continue;

    // Use FOLDER_ID when available; fall back to LATEST_FOLDER_ID so the device still exists.
    const effectiveFolderId = hasFolderId ? folderId : latestFolderId;

    devices.push({
      id: `d${n}`,
      name: process.env[`DEVICE_${n}_NAME`] || `d${n}`,
      description: `Device ${n} monitoring station`,
      folderId: effectiveFolderId,
      folderUrl: folderIdToUrl(effectiveFolderId),
      latestDataFolderId: hasLatestFolderId ? latestFolderId : undefined,
      latestDataFolderUrl: hasLatestFolderId ? folderIdToUrl(latestFolderId) : undefined,
      isActive: true,
      addedAt: new Date('2024-01-01')
    });
  }
  
  return devices;
}

// In-memory storage for devices (in production, this would be a database)
class DeviceConfigManager {
  private config: DeviceConfig;
  
  constructor() {
    const envDevices = getDevicesFromEnv();
    this.config = {
      devices: envDevices,
      defaultDeviceId: envDevices.length > 0 ? envDevices[0].id : undefined
    };
  }

  // Get all devices
  getAllDevices(): Device[] {
    return this.config.devices.filter(device => device.isActive);
  }

  // Get device by ID
  getDevice(id: string): Device | null {
    return this.config.devices.find(device => device.id === id && device.isActive) || null;
  }

  // Get default device
  getDefaultDevice(): Device | null {
    if (this.config.defaultDeviceId) {
      return this.getDevice(this.config.defaultDeviceId);
    }
    const activeDevices = this.getAllDevices();
    return activeDevices.length > 0 ? activeDevices[0] : null;
  }

  // Add new device
  addDevice(name: string, folderUrl: string, description?: string): Device | null {
    const folderId = extractFolderIdFromUrl(folderUrl);
    if (!folderId) {
      throw new Error('Invalid Google Drive folder URL');
    }

    // Check if device already exists
    const existingDevice = this.config.devices.find(d => d.folderId === folderId);
    if (existingDevice) {
      if (existingDevice.isActive) {
        throw new Error('Device with this folder already exists');
      } else {
        // Reactivate existing device
        existingDevice.isActive = true;
        existingDevice.name = name;
        existingDevice.description = description;
        return existingDevice;
      }
    }

    const newDevice: Device = {
      id: `bridge-${Date.now().toString(36)}`,
      name,
      description,
      folderId,
      folderUrl: folderIdToUrl(folderId),
      isActive: true,
      addedAt: new Date()
    };

    this.config.devices.push(newDevice);
    
    // Set as default if it's the first device
    if (!this.config.defaultDeviceId) {
      this.config.defaultDeviceId = newDevice.id;
    }

    return newDevice;
  }

  // Remove device (soft delete)
  removeDevice(id: string): boolean {
    const device = this.config.devices.find(d => d.id === id);
    if (!device) {
      return false;
    }

    device.isActive = false;

    // If this was the default device, set a new default
    if (this.config.defaultDeviceId === id) {
      const activeDevices = this.getAllDevices();
      this.config.defaultDeviceId = activeDevices.length > 0 ? activeDevices[0].id : undefined;
    }

    return true;
  }

  // Set default device
  setDefaultDevice(id: string): boolean {
    const device = this.getDevice(id);
    if (!device) {
      return false;
    }

    this.config.defaultDeviceId = id;
    return true;
  }

  // Update device last accessed timestamp
  updateLastAccessed(id: string): void {
    const device = this.config.devices.find(d => d.id === id);
    if (device) {
      device.lastAccessed = new Date();
    }
  }

  // Update a device's folder ID (e.g. when auto-discovery finds a working folder)
  updateDeviceFolder(id: string, folderId: string): void {
    const device = this.config.devices.find(d => d.id === id);
    if (device) {
      device.folderId = folderId;
      device.folderUrl = folderIdToUrl(folderId);
    }
  }

  // Get device statistics
  getStats() {
    const activeDevices = this.getAllDevices();
    return {
      totalDevices: activeDevices.length,
      defaultDevice: this.getDefaultDevice()?.name || 'None',
      lastAdded: activeDevices.length > 0 
        ? Math.max(...activeDevices.map(d => d.addedAt.getTime()))
        : null
    };
  }
}

// Export singleton instance
export const deviceConfig = new DeviceConfigManager();

// Helper function to get folder ID for a device (for API usage)
export function getFolderIdForDevice(deviceId?: string): string {
  if (!deviceId) {
    const defaultDevice = deviceConfig.getDefaultDevice();
    if (!defaultDevice) {
      throw new Error('No devices configured');
    }
    return defaultDevice.folderId;
  }

  const device = deviceConfig.getDevice(deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  // Update last accessed
  deviceConfig.updateLastAccessed(deviceId);
  
  return device.folderId;
}

// Helper to get the LIVE / latest data folder ID (for 1min/5min modes)
export function getLatestFolderIdForDevice(deviceId?: string): string {
  const device = deviceId
    ? deviceConfig.getDevice(deviceId)
    : deviceConfig.getDefaultDevice();

  if (!device) {
    throw new Error(deviceId ? `Device not found: ${deviceId}` : 'No devices configured');
  }

  if (!device.latestDataFolderId) {
    throw new Error(`No live-data folder configured for device: ${device.name}`);
  }

  if (deviceId) deviceConfig.updateLastAccessed(deviceId);
  return device.latestDataFolderId;
}