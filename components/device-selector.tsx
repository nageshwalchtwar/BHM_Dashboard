'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Server } from 'lucide-react'

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
  className?: string
}

export function DeviceSelector({ 
  selectedDevice, 
  onDeviceChange, 
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
    onDeviceChange(deviceId)
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-3 py-2">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        <span className="text-base font-semibold text-gray-700">Loading devices...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center space-x-2 text-red-600">
          <Server className="h-5 w-5" />
          <span className="text-base font-semibold">Error loading devices</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDevices} className="h-10 text-base">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-start space-x-3">
      <div className="flex items-center space-x-2">
        <Server className="h-5 w-5 text-blue-600" />
        <span className="text-base font-semibold text-gray-900">Device:</span>
        {stats && (
          <Badge variant="secondary" className="text-sm font-semibold">
            {stats.totalDevices}
          </Badge>
        )}
      </div>
      
      <Select
        value={selectedDevice || defaultDevice?.id || ''}
        onValueChange={handleDeviceSelect}
      >
        <SelectTrigger className="w-56 h-10 text-base font-medium">
          <SelectValue placeholder="Select device..." />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.id} value={device.id}>
              <div className="flex items-center space-x-2">
                <span>{device.name}</span>
                {device.id === defaultDevice?.id && (
                  <Badge variant="outline" className="text-xs">Default</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}