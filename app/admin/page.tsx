'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, 
  Server, 
  Trash2, 
  ExternalLink, 
  Star, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

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

export default function DeviceAdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [defaultDevice, setDefaultDevice] = useState<Device | null>(null)
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Add device form
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    folderUrl: '',
    description: '',
    setAsDefault: false
  })
  const [addLoading, setAddLoading] = useState(false)

  // Check authentication and admin role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const result = await response.json()
        
        if (!result.success) {
          router.push('/login')
          return
        }
        
        if (result.user.role !== 'admin') {
          router.push('/')
          return
        }
        
        setCurrentUser(result.user)
        await fetchDevices()
      } catch (error) {
        router.push('/login')
      }
    }
    
    checkAuth()
  }, [router])

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
      } else {
        setError(result.message || 'Failed to load devices')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDevice = async () => {
    if (!addForm.name || !addForm.folderUrl) {
      setError('Device name and folder URL are required')
      return
    }

    try {
      setAddLoading(true)
      setError(null)
      setSuccess(null)
      
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addForm)
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess('Device added successfully!')
        setShowAddDialog(false)
        setAddForm({ name: '', folderUrl: '', description: '', setAsDefault: false })
        await fetchDevices()
      } else {
        setError(result.message || 'Failed to add device')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add device')
    } finally {
      setAddLoading(false)
    }
  }

  const handleSetDefault = async (deviceId: string) => {
    try {
      setError(null)
      setSuccess(null)
      
      const response = await fetch('/api/devices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceId, setAsDefault: true })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess('Default device updated!')
        await fetchDevices()
      } else {
        setError(result.message || 'Failed to update default device')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update default device')
    }
  }

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this device? This action cannot be undone.')) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      
      const response = await fetch(`/api/devices?id=${deviceId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess('Device removed successfully!')
        await fetchDevices()
      } else {
        setError(result.message || 'Failed to remove device')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove device')
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            href="/"
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Device Administration</h1>
            <p className="text-muted-foreground">Manage bridge monitoring devices and their Google Drive folders</p>
          </div>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>
                Add a new bridge monitoring device by providing its Google Drive folder URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Device Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Bridge Sensor"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folderUrl">Google Drive Folder URL *</Label>
                <Input
                  id="folderUrl"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={addForm.folderUrl}
                  onChange={(e) => setAddForm(prev => ({ ...prev, folderUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this monitoring device..."
                  value={addForm.description}
                  onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="setAsDefault"
                  checked={addForm.setAsDefault}
                  onCheckedChange={(checked) => setAddForm(prev => ({ ...prev, setAsDefault: checked }))}
                />
                <Label htmlFor="setAsDefault">Set as default device</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDevice} disabled={addLoading}>
                {addLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Device
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Devices</p>
                  <p className="text-2xl font-bold">{stats.totalDevices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Default Device</p>
                  <p className="text-lg font-semibold">{stats.defaultDevice}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-lg font-semibold text-green-600">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Devices</CardTitle>
          <CardDescription>
            Manage your bridge monitoring devices and their data sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading devices...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No devices configured</p>
              <p className="text-muted-foreground mb-4">Add your first bridge monitoring device to get started</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {devices.length} device{devices.length !== 1 ? 's' : ''} configured
                </p>
                <Button variant="outline" size="sm" onClick={fetchDevices}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{device.name}</span>
                          {defaultDevice?.id === device.id && (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {device.description || 'No description'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(device.addedAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(device.folderUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          {defaultDevice?.id !== device.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(device.id)}
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveDevice(device.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}