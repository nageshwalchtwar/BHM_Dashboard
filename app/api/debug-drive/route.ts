import { NextResponse } from "next/server"
import { SimpleGoogleDriveAPI } from '@/lib/simple-google-api'
import { deviceConfig, getFolderIdForDevice } from '@/lib/device-config'

// Comprehensive Google Drive debug endpoint
export async function GET(request: Request) {
  try {
    console.log('🔧 Starting comprehensive Google Drive debug...')

    // helper safe fetch with timeout
    async function safeFetch(url: string, opts: any = {}, timeoutMs = 8000) {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal })
        if (!res) return { ok: false, status: null, text: null, error: 'no response' }
        const txt = await res.text()
        return { ok: res.ok, status: res.status, text: txt }
      } catch (err) {
        return { ok: false, status: null, text: null, error: err instanceof Error ? err.message : String(err) }
      } finally {
        clearTimeout(id)
      }
    }
    
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY
    
    // Gather all configured folder IDs for debugging
    const devices = deviceConfig.getAllDevices();
    const defaultDevice = deviceConfig.getDefaultDevice();
    let primaryFolderId: string;
    try {
      primaryFolderId = getFolderIdForDevice(undefined);
    } catch {
      primaryFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        primaryFolderId,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : 'Not set',
        GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '(not set)',
        RAILWAY_GOOGLE_DRIVE_FOLDER_URL: process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL ? '(set)' : '(not set)',
        GOOGLE_DRIVE_PARENT_FOLDER_URL: process.env.GOOGLE_DRIVE_PARENT_FOLDER_URL ? '(set)' : '(not set)',
        configuredDevices: devices.map(d => ({ id: d.id, name: d.name, folderId: d.folderId })),
        defaultDeviceId: defaultDevice?.id || 'none',
      },
      tests: [] as any[]
    }
    
    console.log('📋 Environment check:', JSON.stringify(debugInfo.environment, null, 2))
    
    // Test 1: Basic API Key validation — use files.list with limit=1 (about endpoint needs fields)
    if (apiKey) {
      try {
        console.log('🔑 Testing API key validity...')
        const testUrl = `https://www.googleapis.com/drive/v3/about?fields=user&key=${apiKey}`
        const apiResp = await safeFetch(testUrl, {}, 7000)

        if (apiResp.ok) {
          let parsed = null
          try { parsed = JSON.parse(apiResp.text || '{}') } catch (e) { parsed = apiResp.text }

          debugInfo.tests.push({
            name: 'API Key Validation',
            status: 'PASS',
            details: 'API key is valid',
            response: parsed
          })
        } else {
          debugInfo.tests.push({
            name: 'API Key Validation',
            status: apiResp.error ? 'ERROR' : 'FAIL',
            details: apiResp.error || `HTTP ${apiResp.status}`,
            responseText: apiResp.text || null
          })
        }
      } catch (error) {
        debugInfo.tests.push({
          name: 'API Key Validation',
          status: 'ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      // Test 2: Folder Access  — test each configured device folder
      try {
        console.log('📂 Testing folder access...')
        
        // Test each device folder individually
        const foldersToTest = devices.length > 0
          ? devices.map(d => ({ label: `${d.name} (${d.id})`, folderId: d.folderId }))
          : [{ label: 'default', folderId: primaryFolderId }];
        
        for (const folder of foldersToTest) {
          const api = new SimpleGoogleDriveAPI(folder.folderId, apiKey)
          const files = await api.listFilesWithAPIKey()
          
          debugInfo.tests.push({
            name: `Folder Access: ${folder.label}`,
            status: files && files.length > 0 ? 'PASS' : 'FAIL',
            folderId: folder.folderId,
            details: files ? `Found ${files.length} files` : 'No files found or access denied',
            files: files?.slice(0, 3).map(f => ({
              id: f.id,
              name: f.name,
              modified: f.modifiedTime
            })) || []
          })
        }
        
        // Test 3: File Download — try downloading from the first folder that has files
        const folderWithFiles = foldersToTest.find((folder) => {
          const test = debugInfo.tests.find((t: any) => t.folderId === folder.folderId && t.files?.length > 0);
          return !!test;
        });
        if (folderWithFiles) {
          try {
            console.log('📥 Testing file download...')
            const testEntry = debugInfo.tests.find((t: any) => t.folderId === folderWithFiles.folderId && t.files?.length > 0);
            const latestFile = testEntry.files[0];
            const dlApi = new SimpleGoogleDriveAPI(folderWithFiles.folderId, apiKey);
            const content = await dlApi.downloadFileWithAPIKey(latestFile.id)
            
            const firstLine = content ? content.split('\n')[0] : '';
            debugInfo.tests.push({
              name: 'File Download',
              status: content && content.length > 0 ? 'PASS' : 'FAIL',
              details: content ? `Downloaded ${content.length} characters` : 'No content received',
              fileId: latestFile.id,
              fileName: latestFile.name,
              headerRow: firstLine.substring(0, 300),
              contentPreview: content ? content.substring(0, 300) : null,
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
    
    // Test 4: Raw Google Drive API call — show exact response for primary folder
    if (apiKey && primaryFolderId) {
      try {
        console.log('🎯 Testing raw Google API call...')
        const query = encodeURIComponent(`'${primaryFolderId}' in parents`);
        const rawUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=5&key=${apiKey}&fields=files(id,name,modifiedTime,mimeType)`;
        const rawResp = await safeFetch(rawUrl, {}, 8000);

        let parsedBody: any = null;
        try { parsedBody = JSON.parse(rawResp.text || '{}'); } catch { parsedBody = rawResp.text; }

        debugInfo.tests.push({
          name: 'Raw API Call',
          status: rawResp.ok ? 'PASS' : 'FAIL',
          httpStatus: rawResp.status,
          folderId: primaryFolderId,
          details: rawResp.ok
            ? `OK — ${parsedBody?.files?.length ?? 0} items returned`
            : `HTTP ${rawResp.status} — ${parsedBody?.error?.message || rawResp.text?.substring(0, 200) || 'unknown'}`,
          response: parsedBody,
          hint: rawResp.status === 403 || rawResp.status === 404
            ? 'Folder is not shared publicly. Share it as "Anyone with the link → Viewer" in Google Drive.'
            : rawResp.status === 401
              ? 'API key rejected. Ensure Google Drive API is enabled in Cloud Console and the key has no IP restrictions.'
              : undefined,
        });
      } catch (error) {
        debugInfo.tests.push({
          name: 'Raw API Call',
          status: 'ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
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