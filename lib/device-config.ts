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

// Default device configuration with the 3 new devices
const DEFAULT_DEVICES: Device[] = [
  {
    id: 'bridge-001',
    name: 'd1',
    description: 'Device 1 - Primary monitoring station',
    folderId: '1Aw_zJdQcV5M1Rj5IShq10eLs5wQwjTha',
    folderUrl: folderIdToUrl('1Aw_zJdQcV5M1Rj5IShq10eLs5wQwjTha'),
    isActive: true,
    addedAt: new Date('2024-01-01')
  },
  {
    id: 'bridge-002',
    name: 'd2',
    description: 'Device 2 - Secondary monitoring station',
    folderId: '1DfMUNQ3dNqWUHSoNYLVGW0-v-wqcJlq5',
    folderUrl: folderIdToUrl('1DfMUNQ3dNqWUHSoNYLVGW0-v-wqcJlq5'),
    isActive: true,
    addedAt: new Date('2024-01-01')
  },
  {
    id: 'bridge-003',
    name: 'd3',
    description: 'Device 3 - Tertiary monitoring station',
    folderId: '1P7rHZS4vGaMqsahQhiZl1FQAmI1lk3AH',
    folderUrl: folderIdToUrl('1P7rHZS4vGaMqsahQhiZl1FQAmI1lk3AH'),
    isActive: true,
    addedAt: new Date('2024-01-01')
  }
];

// In-memory storage for devices (in production, this would be a database)
class DeviceConfigManager {
  private config: DeviceConfig;
  
  constructor() {
    this.config = {
      devices: [...DEFAULT_DEVICES],
      defaultDeviceId: 'bridge-001'
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