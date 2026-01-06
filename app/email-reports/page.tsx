"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { 
  Mail, 
  Clock, 
  Send, 
  Users,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Calendar,
  Sunrise,
  Moon,
  Activity,
  Database
} from 'lucide-react'
import Link from 'next/link'

interface CronJob {
  id: string
  name: string
  schedule: string
  nextRun: string
  lastRun?: string
  isActive: boolean
}

interface SystemHealth {
  systemStatus: 'healthy' | 'warning' | 'error'
  totalDevices: number
  onlineDevices: number
  totalDataPoints: number
  dataStatus: 'good' | 'partial' | 'no_data'
}

export default function EmailReportsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Check authentication and load data
  useEffect(() => {
    const checkAuthAndLoad = async () => {
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
        
        await loadReportData()
      } catch (error) {
        router.push('/login')
      }
    }
    
    checkAuthAndLoad()
  }, [router])

  const loadReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/email-reports')
      const result = await response.json()
      
      if (result.success) {
        setJobs(result.jobs)
        setSystemHealth(result.systemHealth)
        setUserStats(result.userStats)
      } else {
        setError(result.error || 'Failed to load report data')
      }
    } catch (err) {
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string, options: any = {}) => {
    try {
      setActionLoading(action)
      setError(null)
      setSuccess(null)
      
      const response = await fetch('/api/email-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, ...options })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess(result.message)
        await loadReportData() // Refresh data
      } else {
        setError(result.error || 'Action failed')
      }
    } catch (err) {
      setError('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleJob = async (jobId: string, isActive: boolean) => {
    await handleAction('toggle', { jobId, isActive })
  }

  const triggerJob = async (jobId: string) => {
    await handleAction('trigger', { jobId })
  }

  const sendTestEmail = async (timeOfDay: 'morning' | 'evening') => {
    await handleAction('test', { timeOfDay })
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
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-600">Loading email reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Email Reports</h1>
              <p className="text-gray-600">Manage automated system status notifications</p>
            </div>
          </div>
          <Button onClick={loadReportData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
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

        {/* System Overview */}
        {systemHealth && userStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Status</p>
                    <p className="text-lg font-bold text-gray-900 capitalize">{systemHealth.systemStatus}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Devices Online</p>
                    <p className="text-lg font-bold text-gray-900">{systemHealth.onlineDevices}/{systemHealth.totalDevices}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-lg font-bold text-gray-900">{userStats.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Email Recipients</p>
                    <p className="text-lg font-bold text-gray-900">{userStats.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scheduled Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Scheduled Reports</span>
            </CardTitle>
            <CardDescription>
              Automated daily system status reports sent to all registered users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div 
                  key={job.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {job.id === 'morning-report' ? (
                        <Sunrise className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Moon className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{job.name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>📅 Daily at {job.schedule}</span>
                        <span>⏰ Next: {new Date(job.nextRun).toLocaleString()}</span>
                        {job.lastRun && (
                          <span>✅ Last: {new Date(job.lastRun).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={job.isActive ? 'default' : 'secondary'}
                      className={job.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                    >
                      {job.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    
                    <Switch
                      checked={job.isActive}
                      onCheckedChange={(checked) => toggleJob(job.id, checked)}
                      disabled={actionLoading === 'toggle'}
                    />
                    
                    <Button
                      onClick={() => triggerJob(job.id)}
                      disabled={actionLoading === 'trigger'}
                      variant="outline"
                      size="sm"
                    >
                      {actionLoading === 'trigger' ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Manual Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>Manual Testing</span>
            </CardTitle>
            <CardDescription>
              Send test emails to verify email delivery and formatting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => sendTestEmail('morning')}
                disabled={actionLoading === 'test'}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Sunrise className="h-4 w-4" />
                <span>Send Test Morning Report</span>
                {actionLoading === 'test' && <RefreshCw className="h-3 w-3 animate-spin" />}
              </Button>
              
              <Button
                onClick={() => sendTestEmail('evening')}
                disabled={actionLoading === 'test'}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Moon className="h-4 w-4" />
                <span>Send Test Evening Report</span>
                {actionLoading === 'test' && <RefreshCw className="h-3 w-3 animate-spin" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <Mail className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Email Notification Features</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>📧 <strong>Daily Reports:</strong> Automatic status emails sent at 10:00 AM and 10:00 PM</p>
                  <p>👥 <strong>All Users:</strong> Reports sent to every registered user account</p>
                  <p>📊 <strong>Comprehensive:</strong> System health, device status, data quality, and recommendations</p>
                  <p>🎨 <strong>Professional:</strong> HTML formatted emails with clear status indicators</p>
                  <p>🔧 <strong>Configurable:</strong> Enable/disable reports and send manual tests</p>
                  <p>✍️ <strong>Signed:</strong> All emails personally signed \"Thanks, Nagesh, Admin\"</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}