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

  const processSelectedFile = async () => {
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
      window.open('https://drive.google.com/drive/folders/1zkX_IaONxj6vRGgD2niwfPCVyAmGZBbE', '_blank')
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
            <Select value={selectedFile} onValueChange={setSelectedFile}>
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
              <strong>Next step:</strong> Copy content from Google Drive and paste below
            </div>
          </div>
        )}

        {/* CSV Content Input */}
        <div className="space-y-2">
          <Label htmlFor="csv-content">CSV Content:</Label>
          <Textarea
            id="csv-content"
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder={selectedFile 
              ? `1. Click "Open in Drive" above\n2. Find and open file: ${selectedFile}\n3. Select all content (Ctrl+A)\n4. Copy (Ctrl+C) and paste here\n5. Click "Plot Data" below`
              : "Select a file first, then paste its CSV content here..."
            }
            rows={6}
            className="font-mono text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={processSelectedFile}
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
                Plot Data
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

        {/* Results */}
        {result && (
          <div className="bg-green-50 p-4 rounded-md">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-4 w-4" />
              <strong>Success!</strong>
            </div>
            <div className="text-sm text-green-600">
              <div>File: <strong>{result.fileName}</strong></div>
              <div>Data Points: <strong>{result.count}</strong> (from latest 1 minute)</div>
              <div>Total Points: <strong>{result.totalCount}</strong></div>
              <div className="mt-2">
                <a href="/latest" className="text-blue-600 underline font-medium">
                  → View Charts Now
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertCircle className="h-4 w-4" />
              <strong>Error</strong>
            </div>
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}