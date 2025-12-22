"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react"

export default function DebugPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [csvData, setCsvData] = useState<any>(null)
  const [folderTest, setFolderTest] = useState<any>(null)

  const runGoogleDriveTest = async () => {
    setIsLoading(true)
    setTestResults(null)
    
    try {
      const response = await fetch('/api/test-drive')
      const results = await response.json()
      setTestResults(results)
    } catch (error) {
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {}
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testCsvDataFetch = async () => {
    setIsLoading(true)
    setCsvData(null)
    
    try {
      const response = await fetch('/api/csv-data-real?minutes=5')  // Test the real data API
      const results = await response.json()
      setCsvData(results)
    } catch (error) {
      setCsvData({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testFolderAccess = async () => {
    setIsLoading(true)
    setFolderTest(null)
    
    try {
      const response = await fetch('/api/test-folder')
      const results = await response.json()
      setFolderTest(results)
    } catch (error) {
      setFolderTest({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Drive Debug Page</h1>
          <p className="text-muted-foreground">
            Test connection to your Google Drive CSV folder
          </p>
        </div>
      </div>

      {/* Quick Setup Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            API Key Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-700 mb-3">
            Your dashboard is showing "No recent data available" because a Google Drive API key is needed to access your CSV files.
          </p>
          <div className="bg-white p-3 rounded border text-xs">
            <p className="font-semibold mb-2">Quick Setup (5 minutes):</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Visit <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600 underline">Google Cloud Console</a></li>
              <li>Create project → Enable "Google Drive API"</li>
              <li>Go to "Credentials" → "Create API Key"</li>
              <li>Copy the API key</li>
              <li>In Vercel: Project Settings → Environment Variables</li>
              <li>Add: <code>GOOGLE_DRIVE_API_KEY</code> = your API key</li>
              <li>Redeploy your app</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Folder Test
            </CardTitle>
            <CardDescription>
              Test if your Google Drive folder is publicly accessible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testFolderAccess} 
              disabled={isLoading}
              className="w-full"
              variant="default"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Test Folder Access
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Google Drive Connection Test
            </CardTitle>
            <CardDescription>
              Test all authentication methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runGoogleDriveTest} 
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Test All Methods
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Real CSV Data Test
            </CardTitle>
            <CardDescription>
              Test the actual API your dashboard uses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testCsvDataFetch} 
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Test Real Data API
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Folder Test Results */}
      {folderTest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {folderTest.summary?.diagnosis === 'FULL_ACCESS' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : folderTest.summary?.diagnosis === 'PARTIAL_ACCESS' ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Folder Access Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Folder Status:</span>
                <Badge variant={folderTest.summary?.diagnosis === 'FULL_ACCESS' ? 'default' : 'destructive'}>
                  {folderTest.summary?.diagnosis?.replace('_', ' ') || 'UNKNOWN'}
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Test Results:</h4>
                {folderTest.tests?.map((test: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 rounded border">
                    <span>{test.test}</span>
                    <div className="flex items-center gap-2">
                      {test.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {test.success ? 'OK' : `Error: ${test.error || test.message}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {folderTest.summary?.nextSteps && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Next Steps:</h4>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {folderTest.summary.nextSteps.map((step: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 bg-current rounded-full flex-shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <a 
                  href={folderTest.folderUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 underline inline-flex items-center gap-1"
                >
                  Open your Google Drive folder <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Drive Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Google Drive Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.success ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-600">✅ Success!</h4>
                  <p className="text-sm text-muted-foreground">{testResults.message}</p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h5 className="font-medium">Folder Info:</h5>
                    <p className="text-sm">ID: {testResults.data.folderId}</p>
                    <p className="text-sm">Total Files: {testResults.data.totalFiles}</p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium">Latest File:</h5>
                    <p className="text-sm">Name: {testResults.data.latestFile.name}</p>
                    <p className="text-sm">Size: {testResults.data.latestFile.size}</p>
                    <p className="text-sm">Modified: {new Date(testResults.data.latestFile.modifiedTime).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium">All Files:</h5>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {testResults.data.allFiles.map((file: any, index: number) => (
                      <div key={index} className="text-sm border-l-2 border-blue-200 pl-2">
                        <span className="font-mono">{file.name}</span> 
                        <span className="text-muted-foreground ml-2">
                          ({file.size}, {new Date(file.modifiedTime).toLocaleString()})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-medium">Content Sample:</h5>
                  <pre className="text-xs bg-slate-50 p-2 rounded max-h-40 overflow-auto">
                    {testResults.data.contentSample}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold text-red-600">❌ Error</h4>
                  <p className="text-sm text-red-600">{testResults.error}</p>
                </div>
                
                <div>
                  <h5 className="font-medium">Debug Info:</h5>
                  <pre className="text-xs bg-slate-50 p-2 rounded">
                    {JSON.stringify(testResults.debug, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CSV Data Test Results */}
      {csvData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {csvData.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              CSV Data Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {csvData.success ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-600">✅ Success!</h4>
                  <p className="text-sm">Found {csvData.count} data points in the last {csvData.timeRange}</p>
                  <p className="text-sm text-muted-foreground">Last update: {csvData.lastUpdate}</p>
                </div>
                
                {csvData.data && csvData.data.length > 0 && (
                  <div>
                    <h5 className="font-medium">Sample Data Points:</h5>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {csvData.data.slice(0, 10).map((item: any, index: number) => (
                        <div key={index} className="text-xs bg-slate-50 p-2 rounded border-l-2 border-blue-200">
                          <div className="font-mono">
                            Time: {new Date(item.timestamp).toLocaleString()}
                          </div>
                          <div>
                            Vibration: {item.vibration} Hz, 
                            Acceleration: {item.acceleration} g, 
                            Strain: {item.strain} με, 
                            Temperature: {item.temperature} °C
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h4 className="font-semibold text-red-600">❌ Error</h4>
                <p className="text-sm text-red-600">{csvData.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">Your Google Drive Folder:</h4>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
              </code>
              <a 
                href="https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold">To enable access:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-2">
              <li><strong>Get Google Drive API Key:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600">Google Cloud Console</a></li>
                  <li>Create/select project → Enable Google Drive API</li>
                  <li>Credentials → Create API Key</li>
                </ul>
              </li>
              <li><strong>Add to Vercel:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Go to your Vercel dashboard</li>
                  <li>Project Settings → Environment Variables</li>
                  <li>Add: <code className="bg-slate-100 px-1">GOOGLE_DRIVE_API_KEY</code></li>
                </ul>
              </li>
              <li><strong>Your folder is public ✅</strong> - No folder permissions needed</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold">Environment Variables:</h4>
            <pre className="bg-slate-50 p-2 rounded text-xs">
{`GOOGLE_DRIVE_FOLDER_ID=17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
GOOGLE_DRIVE_API_KEY=your_api_key_here`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}