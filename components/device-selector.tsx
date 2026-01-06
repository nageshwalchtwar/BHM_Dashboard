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
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading devices...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-red-600">
              <Server className="h-4 w-4" />
              <span className="text-sm">Error loading devices</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDevices}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentDevice = selectedDevice 
    ? devices.find(d => d.id === selectedDevice) || null
    : defaultDevice

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Server className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Device Selector</span>
              {stats && (
                <Badge variant="secondary" className="text-xs">
                  {stats.totalDevices} device{stats.totalDevices !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            <Select
              value={selectedDevice || 'default'}
              onValueChange={handleDeviceSelect}
            >
              <SelectTrigger className="h-9">
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
                        <span className="text-xs text-muted-foreground">
                          {device.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentDevice && (
              <div className="mt-2 text-xs text-muted-foreground">
                Current: {currentDevice.name}
                {currentDevice.description && (
                  <span className="block">{currentDevice.description}</span>
                )}
              </div>
            )}
          </div>

          {onAdminClick && (
            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onAdminClick}
                className="h-8"
              >
                <Settings className="h-3 w-3 mr-1" />
                Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDevices}
                className="h-8"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}