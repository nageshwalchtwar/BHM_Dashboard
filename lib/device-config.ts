// Device configuration system for multi-device support
export interface Device {
  id: string;
  name: string;
  description?: string;
  folderId: string;
  folderUrl: string;
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

// Get devices from environment variables
function getDevicesFromEnv(): Device[] {
  const devices: Device[] = [];
  
  // Device 1
  const device1FolderId = process.env.DEVICE_1_FOLDER_ID;
  if (device1FolderId) {
    devices.push({
      id: 'd1',
      name: process.env.DEVICE_1_NAME || 'd1',
      description: 'Device 1 monitoring station',
      folderId: device1FolderId,
      folderUrl: folderIdToUrl(device1FolderId),
      isActive: true,
      addedAt: new Date('2024-01-01')
    });
  }
  
  // Device 2
  const device2FolderId = process.env.DEVICE_2_FOLDER_ID;
  if (device2FolderId) {
    devices.push({
      id: 'd2',
      name: process.env.DEVICE_2_NAME || 'd2',
      description: 'Device 2 monitoring station',
      folderId: device2FolderId,
      folderUrl: folderIdToUrl(device2FolderId),
      isActive: true,
      addedAt: new Date('2024-01-01')
    });
  }
  
  // Device 3
  const device3FolderId = process.env.DEVICE_3_FOLDER_ID;
  if (device3FolderId) {
    devices.push({
      id: 'd3',
      name: process.env.DEVICE_3_NAME || 'd3',
      description: 'Device 3 monitoring station',
      folderId: device3FolderId,
      folderUrl: folderIdToUrl(device3FolderId),
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