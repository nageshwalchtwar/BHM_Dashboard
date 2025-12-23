import { NextResponse } from "next/server"
import { SimpleGoogleDriveAPI } from '@/lib/simple-google-api'

// Comprehensive Google Drive debug endpoint
export async function GET(request: Request) {
  try {
    console.log('🔧 Starting comprehensive Google Drive debug...')
    
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai'
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        folderId: folderId,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : 'Not set'
      },
      tests: [] as any[]
    }
    
    console.log('📋 Environment check:', debugInfo.environment)
    
    // Test 1: Basic API Key validation
    if (apiKey) {
      try {
        console.log('🔑 Testing API key validity...')
        const testUrl = `https://www.googleapis.com/drive/v3/about?key=${apiKey}`
        const response = await fetch(testUrl)
        
        debugInfo.tests.push({
          name: 'API Key Validation',
          status: response.ok ? 'PASS' : 'FAIL',
          details: response.ok ? 'API key is valid' : `HTTP ${response.status}: ${response.statusText}`,
          response: response.ok ? await response.json() : await response.text()
        })
      } catch (error) {
        debugInfo.tests.push({
          name: 'API Key Validation',
          status: 'ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      // Test 2: Folder Access
      try {
        console.log('📂 Testing folder access...')
        const api = new SimpleGoogleDriveAPI(folderId, apiKey)
        const files = await api.listFilesWithAPIKey()
        
        debugInfo.tests.push({
          name: 'Folder Access',
          status: files && files.length > 0 ? 'PASS' : 'FAIL',
          details: files ? `Found ${files.length} files` : 'No files found or access denied',
          files: files?.slice(0, 5).map(f => ({
            id: f.id,
            name: f.name,
            modified: f.modifiedTime
          })) || []
        })
        
        // Test 3: File Download
        if (files && files.length > 0) {
          try {
            console.log('📥 Testing file download...')
            const latestFile = files[0]
            const content = await api.downloadFileWithAPIKey(latestFile.id)
            
            debugInfo.tests.push({
              name: 'File Download',
              status: content && content.length > 0 ? 'PASS' : 'FAIL',
              details: content ? `Downloaded ${content.length} characters` : 'No content received',
              fileId: latestFile.id,
              fileName: latestFile.name,
              contentPreview: content ? content.substring(0, 200) : null,
              isCSV: content ? content.includes('Device') || content.includes('CSV') : false
            })
          } catch (error) {
            debugInfo.tests.push({
              name: 'File Download',
              status: 'ERROR',
              details: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
        
      } catch (error) {
        debugInfo.tests.push({
          name: 'Folder Access',
          status: 'ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      debugInfo.tests.push({
        name: 'API Key Check',
        status: 'FAIL',
        details: 'No API key found in environment variables'
      })
    }
    
    // Test 4: Direct file access attempts
    try {
      console.log('🎯 Testing direct file access patterns...')
      const testPatterns = [
        '2025-12-23_13-50', // Current time pattern
        '2025-12-23_13-40',
        '2025-12-23_13-30',
        '2025-12-23_12-50',
        '2025-12-23_12-40'
      ]
      
      const directAccessResults = []
      
      for (const pattern of testPatterns.slice(0, 3)) {
        try {
          const url = `https://docs.google.com/spreadsheets/d/${pattern}/export?format=csv`
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'BHM-Dashboard/1.0',
              'Accept': 'text/csv,*/*'
            }
          })
          
          const content = response.ok ? await response.text() : null
          
          directAccessResults.push({
            pattern: pattern,
            url: url,
            status: response.status,
            success: response.ok && content && content.length > 100,
            contentLength: content?.length || 0,
            contentPreview: content ? content.substring(0, 100) : null,
            isCSV: content ? content.includes('Device') : false
          })
          
          if (response.ok && content && content.includes('Device')) {
            console.log(`✅ Found working pattern: ${pattern}`)
            break // Found a working pattern
          }
          
        } catch (error) {
          directAccessResults.push({
            pattern: pattern,
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      debugInfo.tests.push({
        name: 'Direct Pattern Access',
        status: directAccessResults.some(r => r.success) ? 'PASS' : 'FAIL',
        details: `Tested ${directAccessResults.length} patterns`,
        results: directAccessResults
      })
      
    } catch (error) {
      debugInfo.tests.push({
        name: 'Direct Pattern Access',
        status: 'ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Summary
    const passCount = debugInfo.tests.filter(t => t.status === 'PASS').length
    const totalTests = debugInfo.tests.length
    
    debugInfo.summary = {
      overallStatus: passCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED',
      passedTests: passCount,
      totalTests: totalTests,
      recommendation: passCount > 0 ? 
        'Some methods are working. Check the successful tests above.' :
        'All methods failed. Check API key and folder permissions.'
    }
    
    console.log('🏁 Debug complete:', debugInfo.summary)
    
    return NextResponse.json(debugInfo, { status: 200 })
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}