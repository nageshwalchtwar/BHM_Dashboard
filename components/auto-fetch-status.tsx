'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Upload, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AutoFetchStatusProps {
  onDataUpdate?: () => void
}

export function AutoFetchStatus({ onDataUpdate }: AutoFetchStatusProps) {
  const [lastFetch, setLastFetch] = useState<string>('')
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle')
  const [dataSource, setDataSource] = useState<string>('none')
  const [message, setMessage] = useState<string>('')
  const [showRealDataHelp, setShowRealDataHelp] = useState(false)
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

  const showRealDataInstructions = async () => {
    setShowRealDataHelp(true)
    try {
      const response = await fetch('/api/real-data-help')
      const help = await response.json()
      
      if (help.success) {
        // Show instructions in a more user-friendly way
        setMessage('📋 Real data instructions loaded. Check browser console for details, or use the upload method.')
        console.log('🎯 REAL DATA ACCESS INSTRUCTIONS:', help)
      }
    } catch (error) {
      setMessage('❌ Failed to load real data instructions')
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
      case 'real-csv-file':
        return '🎯 Real CSV file from Google Drive'
      case 'auto-drive':
      case 'simple-auto': 
      case 'direct-auto':
        return '🤖 Auto-fetched from Google Drive'
      case 'uploaded':
        return '📁 Using uploaded real data'
      case 'google-drive-api':
        return '🔑 Google Drive API'
      default:
        return '⏳ Searching for real CSV files'
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
          
          {(dataSource === 'none' || dataSource === 'cached') && (
            <>
              <Button
                onClick={() => window.open('https://drive.google.com/drive/folders/1zkX_IaONxj6vRGgD2niwfPCVyAmGZBbE', '_blank')}
                size="sm"
                variant="secondary"
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Open Drive Folder
              </Button>
              
              <Button
                onClick={() => router.push('/upload')}
                size="sm"
                variant="default"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload CSV
              </Button>
            </>
          )}
        </div>
        
        {(dataSource === 'real-csv-file' || dataSource === 'auto-drive' || dataSource === 'simple-auto' || dataSource === 'direct-auto') && (
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            ✅ Successfully accessing your real CSV files! Data updates every 2 minutes.
          </div>
        )}
        
        {dataSource === 'uploaded' && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            📁 Using your uploaded CSV data. Upload newer files to update the dashboard.
          </div>
        )}
        
        {dataSource === 'none' && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            � <strong>Quick Fix:</strong> Click "Open Drive Folder" → Open your latest CSV file → 
            Copy all content → Click "Upload CSV" → Paste → Process. Your charts will work immediately!
          </div>
        )}
        
        {dataSource === 'cached' && (
          <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
            ⏳ Using cached data. Click "Open Drive Folder" to get your latest CSV file and upload it for fresh data.
          </div>
        )}
      </CardContent>
    </Card>
  )
}