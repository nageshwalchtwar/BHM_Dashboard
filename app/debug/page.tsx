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
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [emergencyTest, setEmergencyTest] = useState<any>(null)
  const [diagnosis, setDiagnosis] = useState<any>(null)

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

  const runComprehensiveDiagnosis = async () => {
    setIsLoading(true)
    setDiagnosis(null)
    
    try {
      const response = await fetch('/api/diagnose')
      const results = await response.json()
      setDiagnosis(results)
    } catch (error) {
      setDiagnosis({
        diagnosis: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runEmergencyTest = async () => {
    setIsLoading(true)
    setEmergencyTest(null)
    
    try {
      const response = await fetch('/api/emergency-test')
      const results = await response.json()
      setEmergencyTest(results)
    } catch (error) {
      setEmergencyTest({
        diagnosis: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        results: []
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

      {/* Primary Diagnosis */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <AlertTriangle className="h-5 w-5" />
            🔧 Connection Issues? Run Full Diagnosis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-700 mb-3">
            If you're seeing "No recent data available" or connection problems, run this comprehensive test to identify the exact issue.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <Button 
              onClick={runEmergencyTest}
              disabled={isLoading}
              className="w-full"
              size="lg"
              variant="destructive"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              🚨 Emergency Test (Quick)
            </Button>
            <Button 
              onClick={runComprehensiveDiagnosis}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              🔧 Full Diagnosis
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* Primary Diagnosis */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <AlertTriangle className="h-5 w-5" />
            Connection Issues? Run Full Diagnosis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-700 mb-3">
            If you're seeing "No recent data available" or connection problems, run this comprehensive test to identify the exact issue.
          </p>
          <Button 
            onClick={runComprehensiveDiagnosis}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Run Full Diagnosis
          </Button>
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

      {/* Emergency Test Results */}
      {emergencyTest && (
        <Card className="border-2 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {emergencyTest.diagnosis === 'CSV_FOUND' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              🚨 Emergency Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded border bg-red-50">
                <span className="font-semibold">Quick Diagnosis:</span>
                <Badge 
                  variant={emergencyTest.diagnosis === 'CSV_FOUND' ? 'default' : 'destructive'}
                >
                  {emergencyTest.diagnosis?.replace('_', ' ')}
                </Badge>
              </div>

              {/* Test Results */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Connection Tests:</h4>
                {emergencyTest.results?.map((result: any, index: number) => (
                  <div key={index} className="p-3 rounded border bg-gray-50 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{result.method}</span>
                      <Badge 
                        variant={result.status === 'SUCCESS' ? 'default' : 'destructive'}
                      >
                        {result.status}
                      </Badge>
                    </div>
                    
                    {result.status === 'SUCCESS' && (
                      <div className="mt-2 text-xs space-y-1">
                        <div>📄 Content: {result.contentLength} chars</div>
                        <div>📋 Lines: {result.lines}</div>
                        <div>✅ Looks like CSV: {result.looksLikeCSV ? 'Yes' : 'No'}</div>
                        {result.preview && (
                          <div className="text-gray-600 bg-white p-2 rounded">
                            Preview: {result.preview}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="mt-1 text-xs text-red-600">
                        Error: {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {emergencyTest.summary?.recommendations && (
                <div className="p-3 rounded border bg-green-50">
                  <h4 className="font-semibold text-sm mb-2">🎯 What to Do:</h4>
                  <ul className="text-sm space-y-1">
                    {emergencyTest.summary.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 bg-green-600 rounded-full flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Diagnosis Results */}
      {diagnosis && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {diagnosis.diagnosis === 'WORKING' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : diagnosis.diagnosis === 'CONNECTION_ISSUES' ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              🔧 Full Diagnosis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overall Status */}
              <div className="flex items-center justify-between p-3 rounded border">
                <span className="font-semibold">Overall Status:</span>
                <Badge 
                  variant={
                    diagnosis.diagnosis === 'WORKING' ? 'default' : 
                    diagnosis.diagnosis === 'CONNECTION_ISSUES' ? 'destructive' : 
                    'secondary'
                  }
                >
                  {diagnosis.diagnosis}
                </Badge>
              </div>

              {/* Step-by-Step Results */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Step-by-Step Test Results:</h4>
                <div className="space-y-2">
                  {diagnosis.steps?.map((step: any, index: number) => (
                    <div key={index} className="p-3 rounded border bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          Step {step.step}: {step.name}
                        </span>
                        <Badge 
                          variant={
                            step.status === 'PASS' ? 'default' : 
                            step.status === 'FAIL' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {step.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.details}
                      </p>
                      {step.results && step.results.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-blue-600">
                            View detailed results ({step.results.length} items)
                          </summary>
                          <div className="mt-1 text-xs space-y-1">
                            {step.results.slice(0, 3).map((result: any, idx: number) => (
                              <div key={idx} className="ml-2 p-1 bg-white rounded text-xs">
                                {result.status}: {result.details || result.error || 'No details'}
                                {result.preview && (
                                  <div className="text-gray-500 truncate">
                                    Preview: {result.preview}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {diagnosis.summary?.recommendations && (
                <div className="p-3 rounded border bg-blue-50">
                  <h4 className="font-semibold text-sm mb-2">🎯 What to Do Next:</h4>
                  <ul className="text-sm space-y-1">
                    {diagnosis.summary.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 bg-blue-600 rounded-full flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Test completed at: {diagnosis.timestamp}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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