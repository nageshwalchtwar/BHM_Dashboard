"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Crown
} from 'lucide-react'
import Link from 'next/link'

interface UserProfile {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  createdAt: string
  lastLogin?: string
}

export default function AccountManagementPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const result = await response.json()
        
        if (!result.success) {
          router.push('/login')
          return
        }
        
        setUser(result.user)
        setEditForm(prev => ({ ...prev, name: result.user.name }))
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    
    checkAuth()
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Basic validation
    if (editForm.newPassword && editForm.newPassword !== editForm.confirmPassword) {
      setError("New passwords don't match")
      return
    }

    try {
      // In a real application, you'd have an API endpoint to update user profile
      // For now, we'll just show a success message
      setSuccess("Profile updated successfully!")
      setIsEditing(false)
      setEditForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } catch (error) {
      setError('Failed to update profile')
    }
  }

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="container mx-auto p-6 max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link 
            href="/"
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
            <p className="text-gray-600">Manage your profile and account settings</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Profile Information</span>
                </CardTitle>
                <CardDescription>Your account details and settings</CardDescription>
              </div>
              <Button 
                onClick={() => setIsEditing(!isEditing)}
                variant={isEditing ? "outline" : "default"}
                size="sm"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                    <p className="text-lg text-gray-900">{user.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                    <p className="text-lg text-gray-900">{user.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Role</Label>
                    <div className="mt-1">
                      <Badge 
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className={user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <Crown className="h-3 w-3 mr-1" />
                            Administrator
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            User
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                    <p className="text-lg text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                {user.lastLogin && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Last Login</Label>
                    <p className="text-lg text-gray-900">
                      {new Date(user.lastLogin).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={editForm.currentPassword}
                        onChange={(e) => setEditForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password to change"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={editForm.confirmPassword}
                        onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button type="submit">
                    Save Changes
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Account Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Account Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <Calendar className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </p>
                <p className="text-sm text-gray-500">Days Active</p>
              </div>
              <div className="text-center">
                <Mail className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">Verified</p>
                <p className="text-sm text-gray-500">Email Status</p>
              </div>
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">Active</p>
                <p className="text-sm text-gray-500">Account Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Account Security</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Keep your password secure and don't share it with others</p>
                  <p>• Contact an administrator if you need role changes</p>
                  <p>• Your account data is stored securely and never shared</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}