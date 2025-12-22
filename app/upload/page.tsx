"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, Copy, CheckCircle, AlertTriangle } from "lucide-react"
import { parseCSVToSensorData } from "@/lib/csv-handler"

export default function UploadDataPage() {
  const [csvContent, setCsvContent] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setCsvContent(content)
        processCSV(content)
      }
      reader.readAsText(file)
    }
  }

  const processCSV = async (content: string) => {
    setIsUploading(true)
    setUploadResult(null)

    try {
      // Parse the CSV content
      const parsedData = parseCSVToSensorData(content)
      
      // Send to our API to store temporarily
      const response = await fetch('/api/csv-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvContent: content })
      })

      const result = await response.json()
      
      setUploadResult({
        success: true,
        message: `Successfully processed ${parsedData.length} data points`,
        data: parsedData.slice(0, 5), // Show first 5 rows
        totalRows: parsedData.length
      })

    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handlePasteProcess = () => {
    if (csvContent.trim()) {
      processCSV(csvContent)
    }
  }

  const sampleData = `Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C
88A29E218213,20:29:09,25.437,0.352109375,0.4898046875,-0.8116484375,0.02083333333
88A29E218213,20:29:10,25.438,0.353015625,0.4901234567,-0.8118765432,0.02084567890
88A29E218213,20:29:11,25.439,0.354123456,0.4904567890,-0.8121123456,0.02085678901`

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Upload Your Real CSV Data 🎯</h1>
          <p className="text-muted-foreground">
            Get your actual sensor data from Google Drive working in 2 minutes
          </p>
        </div>
      </div>

      {/* Step-by-step instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            📋 Quick Steps (2 minutes)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <div className="grid md:grid-cols-2 gap-4">
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Open your folder:</strong> <a href="https://drive.google.com/drive/folders/1zkX_IaONxj6vRGgD2niwfPCVyAmGZBbE" target="_blank" rel="noopener" className="text-blue-600 underline">BHM_D1 Google Drive</a></li>
              <li><strong>Latest file:</strong> Click "2025-12-20_20-50" (or newest)</li>
              <li><strong>Copy all:</strong> Ctrl+A → Ctrl+C</li>
            </ol>
            <ol className="list-decimal list-inside space-y-2" start={4}>
              <li><strong>Paste below:</strong> In the text area</li>
              <li><strong>Process:</strong> Click the button</li>
              <li><strong>View:</strong> Go to <a href="/latest" className="text-blue-600 underline">/latest</a> for charts!</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Upload Methods */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select and upload your CSV file directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to select CSV file</p>
                </label>
              </div>
              
              <div className="text-xs text-gray-500">
                <p className="font-semibold">Expected format:</p>
                <code className="bg-gray-100 px-1 rounded">
                  Device, Timestamp, X, Y, Z, Stroke_mm, Temperature_C
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paste Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Paste CSV Data
            </CardTitle>
            <CardDescription>
              Copy and paste your CSV content directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder={sampleData}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              
              <Button 
                onClick={handlePasteProcess}
                disabled={!csvContent.trim() || isUploading}
                className="w-full"
              >
                {isUploading ? "Processing..." : "Process CSV Data"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uploadResult.success ? (
              <div className="space-y-4">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-green-800 font-semibold">✅ Success!</p>
                  <p className="text-green-700 text-sm">{uploadResult.message}</p>
                </div>
                
                {uploadResult.data && uploadResult.data.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Sample Data Preview:</h4>
                    <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                      {uploadResult.data.map((item: any, index: number) => (
                        <div key={index} className="font-mono">
                          <span className="text-blue-600">Time:</span> {new Date(item.timestamp).toLocaleString()} |{" "}
                          <span className="text-green-600">X:</span> {item.x} |{" "}
                          <span className="text-purple-600">Y:</span> {item.y} |{" "}
                          <span className="text-orange-600">Z:</span> {item.z} |{" "}
                          <span className="text-yellow-600">Stroke:</span> {item.stroke_mm} |{" "}
                          <span className="text-red-600">Temp:</span> {item.temperature_c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-blue-800 text-sm">
                    🚀 <strong>Data uploaded!</strong> Now go to the <a href="/latest" className="underline font-semibold">Latest Data</a> page to see your charts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 p-3 rounded">
                <p className="text-red-800 font-semibold">❌ Error</p>
                <p className="text-red-700 text-sm">{uploadResult.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">Option 1: Download from Google Drive</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground mt-1">
              <li>Go to your <a href="https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai" target="_blank" className="text-blue-600 underline">Google Drive folder</a></li>
              <li>Right-click on your latest CSV file → Download</li>
              <li>Upload the downloaded file here</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold">Option 2: Copy-Paste Content</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground mt-1">
              <li>Open your CSV file in Google Drive</li>
              <li>Select all content (Ctrl+A) and copy (Ctrl+C)</li>
              <li>Paste into the text area above</li>
              <li>Click "Process CSV Data"</li>
            </ol>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded">
            <p className="text-yellow-800 text-sm">
              <strong>💡 Tip:</strong> This data will be temporarily stored for your session. For automatic updates, you'd still need the Google Drive API setup, but this gives you immediate access to view your data!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}