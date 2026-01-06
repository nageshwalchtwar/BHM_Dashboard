'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Settings, Server } from 'lucide-react'

interface Device {
  id: string
  name: string
  description?: string
  folderId: string
  folderUrl: string
  isActive: boolean
  addedAt: Date
  lastAccessed?: Date
}

interface DeviceStats {
  totalDevices: number
  defaultDevice: string
  lastAdded: number | null
}

interface DeviceSelectorProps {
  selectedDevice?: string
  onDeviceChange: (deviceId: string | undefined) => void
  onAdminClick?: () => void
  className?: string
}

export function DeviceSelector({ 
  selectedDevice, 
  onDeviceChange, 
  onAdminClick,
  className 
}: DeviceSelectorProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [defaultDevice, setDefaultDevice] = useState<Device | null>(null)
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/devices')
      const result = await response.json()
      
      if (result.success) {
        setDevices(result.devices)
        setDefaultDevice(result.defaultDevice)
        setStats(result.stats)
        
        // If no device is selected, select the default device
        if (!selectedDevice && result.defaultDevice) {
          onDeviceChange(result.defaultDevice.id)
        }
      } else {
        setError(result.message || 'Failed to load devices')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleDeviceSelect = (deviceId: string) => {
    onDeviceChange(deviceId === 'default' ? undefined : deviceId)
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2 py-2">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-600">Loading devices...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center space-x-2 text-red-600">
          <Server className="h-4 w-4" />
          <span className="text-sm">Error loading devices</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDevices} className="h-8">
          Retry
        </Button>
      </div>
    )
  }

  const currentDevice = selectedDevice 
    ? devices.find(d => d.id === selectedDevice) || null
    : defaultDevice

  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Device:</span>
          {stats && (
            <Badge variant="secondary" className="text-xs">
              {stats.totalDevices}
            </Badge>
          )}
        </div>
        
        <Select
          value={selectedDevice || 'default'}
          onValueChange={handleDeviceSelect}
        >
          <SelectTrigger className="w-48 h-8">
            <SelectValue placeholder="Select device..." />
          </SelectTrigger>
          <SelectContent>
            {defaultDevice && (
              <SelectItem value="default">
                <div className="flex items-center space-x-2">
                  <span>{defaultDevice.name}</span>
                  <Badge variant="outline" className="text-xs">Default</Badge>
                </div>
              </SelectItem>
            )}
            {devices.filter(d => d.id !== defaultDevice?.id).map((device) => (
              <SelectItem key={device.id} value={device.id}>
                <div className="flex flex-col">
                  <span>{device.name}</span>
                  {device.description && (
                    <span className="text-xs text-gray-500">
                      {device.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentDevice && (
          <span className="text-xs text-gray-500">
            {currentDevice.name}
          </span>
        )}
      </div>

      {onAdminClick && (
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onAdminClick}
            className="h-8 px-3"
          >
            <Settings className="h-3 w-3 mr-1" />
            Admin
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDevices}
            className="h-8 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}