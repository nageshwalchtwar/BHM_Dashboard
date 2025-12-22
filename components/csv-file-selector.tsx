'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RefreshCw, Upload, FileText, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface CSVFile {
  name: string
  timestamp: string
  size: string
  description: string
}

interface CSVSelectorProps {
  onDataUpdate?: (data: any) => void
}

export function CSVFileSelector({ onDataUpdate }: CSVSelectorProps) {
  const [files, setFiles] = useState<CSVFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadAvailableFiles()
  }, [])

  const loadAvailableFiles = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/list-csv-files')
      const data = await response.json()
      
      if (data.success) {
        setFiles(data.files || [])
      } else {
        setError('Failed to load file list')
      }
    } catch (err) {
      setError('Failed to load available files')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelection = async (fileName: string) => {
    setSelectedFile(fileName)
    setError('')
    setResult(null)
    
    if (fileName) {
      console.log(`📁 Selected file: ${fileName}`)
      // Automatically fetch and process the selected file
      await processSelectedFile(fileName)
    }
  }

  const processSelectedFile = async (fileName: string) => {
    try {
      setIsProcessing(true)
      setError('')
      
      // Fetch the specific selected file
      const response = await fetch('/api/fetch-specific-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.data && data.data.length > 0) {
        setResult({
          success: true,
          dataPoints: data.data.length,
          source: data.metadata?.fetchMethod || 'specific-file',
          message: `Successfully loaded ${data.data.length} data points from ${fileName}!`,
          fileName: fileName,
          fetchMethod: data.metadata?.fetchMethod
        })
        onDataUpdate?.(data)
        setCsvContent('') // Clear the manual input area since we got data automatically
      } else {
        setError(data.error || 'No data available. Try the manual process below.')
      }
    } catch (err) {
      setError('Failed to automatically load data. Try the manual process below.')
      console.error('Auto fetch error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const processAutoData = async () => {
    if (!selectedFile) {
      setError('No file selected')
      return
    }
    
    await processSelectedFile(selectedFile)
  }
        
  const processManualFile = async () => {
    if (!selectedFile || !csvContent.trim()) {
      setError('Please select a file and provide its content')
      return
    }

    try {
      setIsProcessing(true)
      setError('')
      
      const response = await fetch('/api/process-selected-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile,
          csvContent: csvContent.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(data)
        onDataUpdate?.(data)
        
        // Also store in the main CSV data store
        const storeResponse = await fetch('/api/csv-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ csvContent: csvContent.trim() })
        })
        
        if (storeResponse.ok) {
          console.log('✅ Data stored successfully')
        }
      } else {
        setError(data.message || data.error || 'Failed to process file')
      }
    } catch (err) {
      setError('Failed to process the selected file')
      console.error('Process error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const openGoogleDriveFile = () => {
    if (selectedFile) {
      // Open the Google Drive folder
      window.open('https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai', '_blank')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Select CSV File to Plot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Selection */}
        <div className="space-y-2">
          <Label htmlFor="file-select">Choose CSV File:</Label>
          <div className="flex gap-2">
            <Select value={selectedFile} onValueChange={handleFileSelection}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a CSV file..." />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file.name} value={file.name}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{file.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={openGoogleDriveFile}
              disabled={!selectedFile}
              variant="outline"
              size="sm"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Drive
            </Button>
          </div>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="text-sm">
              <strong>Selected:</strong> {selectedFile}
              <br />
              {isProcessing ? (
                <span className="text-blue-600 flex items-center gap-2 mt-1">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Automatically loading data...
                </span>
              ) : result ? (
                <span className="text-green-600 flex items-center gap-2 mt-1">
                  <CheckCircle className="h-4 w-4" />
                  Data loaded automatically!
                </span>
              ) : (
                <span className="text-amber-600">
                  <strong>Next step:</strong> Copy content from Google Drive and paste below
                </span>
              )}
            </div>
          </div>
        )}

        {/* Manual CSV Content Input - only if auto-loading failed or not attempted */}
        {selectedFile && !result && (
          <div className="space-y-2">
            <Label htmlFor="csv-content">Manual Fallback - CSV Content:</Label>
            <div className="text-xs text-gray-600 mb-2">
              If automatic loading didn't work, manually paste your CSV content below:
            </div>
            <Textarea
              id="csv-content"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`1. Click "Open in Drive" above\n2. Find and open file: ${selectedFile}\n3. Select all content (Ctrl+A)\n4. Copy (Ctrl+C) and paste here\n5. Click "Process Manual Data" below`}
              rows={6}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* Action Buttons - only show manual processing if needed */}
        {selectedFile && !result && (
          <div className="flex gap-2">
            <Button
              onClick={processManualFile}
              disabled={!selectedFile || !csvContent.trim() || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Process Manual Data
                </>
              )}
            </Button>
            
            <Button
              onClick={loadAvailableFiles}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}

        {/* Refresh button for file list */}
        {!selectedFile && (
          <div className="flex justify-end">
            <Button
              onClick={loadAvailableFiles}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Files
            </Button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-green-50 p-4 rounded-md">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-4 w-4" />
              <strong>Success!</strong>
            </div>
            <div className="text-sm text-green-600">
              {result.fileName && <div>File: <strong>{result.fileName}</strong></div>}
              <div>Data Points: <strong>{result.dataPoints || result.count}</strong> 
                {result.count && ' (from latest 1 minute)'}
              </div>
              {result.totalCount && <div>Total Points: <strong>{result.totalCount}</strong></div>}
              <div>Source: <strong>{result.source === 'auto-fetch' ? 'Automatic Load' : 'Manual Input'}</strong></div>
              <div className="mt-2">
                <strong>Charts are now updated with your data!</strong>
              </div>
              {result.message && (
                <div className="mt-2 text-xs text-gray-600">
                  {result.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertCircle className="h-4 w-4" />
              <strong>Automatic Loading Failed</strong>
            </div>
            <div className="text-sm text-red-600 mb-3">{error}</div>
            <div className="flex gap-2">
              <Button
                onClick={processAutoData}
                disabled={isProcessing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}