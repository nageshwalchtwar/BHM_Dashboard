'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AutoFetchStatusProps {
  onDataUpdate?: () => void
}

export function AutoFetchStatus({ onDataUpdate }: AutoFetchStatusProps) {
  const [lastFetch, setLastFetch] = useState<string>('')
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle')
  const [dataSource, setDataSource] = useState<string>('none')
  const [message, setMessage] = useState<string>('')
  const router = useRouter()

  const checkDataStatus = async () => {
    try {
      setFetchStatus('fetching')
      const response = await fetch('/api/csv-data?minutes=1')
      const data = await response.json()
      
      if (data.success) {
        setFetchStatus('success')
        setDataSource(data.source || 'unknown')
        setLastFetch(data.lastUpdate || new Date().toISOString())
        setMessage(data.message || `${data.count} data points available`)
        onDataUpdate?.()
      } else {
        setFetchStatus('error')
        setMessage(data.message || 'No data available')
      }
    } catch (error) {
      setFetchStatus('error')
      setMessage('Failed to check data status')
    }
  }

  // Auto-check every 30 seconds
  useEffect(() => {
    checkDataStatus()
    const interval = setInterval(checkDataStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = () => {
    switch (fetchStatus) {
      case 'fetching':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <RefreshCw className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    switch (dataSource) {
      case 'auto-drive':
        return 'text-green-600'
      case 'uploaded':
        return 'text-blue-600'
      case 'google-drive-api':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  const getDataSourceLabel = () => {
    switch (dataSource) {
      case 'auto-drive':
        return '🤖 Auto-fetched from Google Drive'
      case 'uploaded':
        return '📁 Using uploaded data'
      case 'google-drive-api':
        return '🔑 Google Drive API'
      default:
        return '⏳ Waiting for data'
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          Data Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Source:</span>
          <span className={`text-sm font-semibold ${getStatusColor()}`}>
            {getDataSourceLabel()}
          </span>
        </div>
        
        {lastFetch && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Update:</span>
            <span className="text-sm text-gray-600">
              {new Date(lastFetch).toLocaleString()}
            </span>
          </div>
        )}
        
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium">Status:</span>
          <span className="text-sm text-gray-600 text-right flex-1">
            {message}
          </span>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button
            onClick={checkDataStatus}
            disabled={fetchStatus === 'fetching'}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          
          {dataSource === 'none' && (
            <Button
              onClick={() => router.push('/upload')}
              size="sm"
              variant="default"
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload CSV
            </Button>
          )}
        </div>
        
        {dataSource === 'auto-drive' && (
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            ✅ Automatic fetching is working! Data updates every 2 minutes.
          </div>
        )}
        
        {dataSource === 'none' && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            🔄 System is trying to auto-fetch from Google Drive every 2 minutes. 
            If this doesn't work, you can upload CSV files manually.
          </div>
        )}
      </CardContent>
    </Card>
  )
}