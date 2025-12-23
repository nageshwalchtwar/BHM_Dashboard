import { NextResponse } from 'next/server';

// Test the Google Drive API key you provided
export async function GET() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
  
  console.log('🔑 Testing your Google Drive API key...');
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    return NextResponse.json({
      success: false,
      error: 'No API key configured',
      message: 'API key not set in environment variables'
    });
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey.substring(0, 20) + '...',
    folderId,
    tests: [] as any[]
  };
  
  try {
    // Test 1: Basic API connectivity
    console.log('🧪 Test 1: Basic API connectivity...');
    const aboutResponse = await fetch(`https://www.googleapis.com/drive/v3/about?fields=user&key=${apiKey}`, {
      signal: AbortSignal.timeout(15000)
    });
    
    results.tests.push({
      test: 'API Connectivity',
      status: aboutResponse.ok ? 'PASS' : 'FAIL',
      httpStatus: aboutResponse.status,
      details: aboutResponse.ok ? 'API key is valid' : `HTTP ${aboutResponse.status} - ${aboutResponse.statusText}`
    });
    
    if (aboutResponse.ok) {
      const aboutData = await aboutResponse.json();
      console.log('✅ API key is valid!', aboutData.user?.displayName || 'User info available');
    }
    
  } catch (error) {
    results.tests.push({
      test: 'API Connectivity',
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  try {
    // Test 2: List files in your folder
    console.log('🧪 Test 2: List files in your folder...');
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&orderBy=modifiedTime desc&key=${apiKey}&fields=files(id,name,modifiedTime,size,mimeType)&pageSize=10`;
    
    const listResponse = await fetch(listUrl, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const files = listData.files || [];
      
      results.tests.push({
        test: 'Folder Access',
        status: 'PASS',
        details: `Found ${files.length} files in folder`,
        files: files.map((f: any) => ({
          name: f.name,
          id: f.id,
          modified: f.modifiedTime,
          size: f.size,
          type: f.mimeType
        }))
      });
      
      console.log(`✅ Found ${files.length} files in your folder`);
      
    } else {
      results.tests.push({
        test: 'Folder Access',
        status: 'FAIL',
        httpStatus: listResponse.status,
        details: `Cannot access folder: HTTP ${listResponse.status}`
      });
    }
    
  } catch (error) {
    results.tests.push({
      test: 'Folder Access',
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  try {
    // Test 3: Download a CSV file (if any found)
    const folderTest = results.tests.find(t => t.test === 'Folder Access' && t.status === 'PASS');
    
    if (folderTest && folderTest.files && folderTest.files.length > 0) {
      // Try to download the first file
      const firstFile = folderTest.files[0];
      console.log(`🧪 Test 3: Download file ${firstFile.name}...`);
      
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${firstFile.id}?alt=media&key=${apiKey}`,
        { signal: AbortSignal.timeout(20000) }
      );
      
      if (downloadResponse.ok) {
        const content = await downloadResponse.text();
        const isCSV = content.includes(',') && (
          content.includes('Device') || 
          content.includes('Timestamp') ||
          content.includes('88A29E218213')
        );
        
        results.tests.push({
          test: 'CSV Download',
          status: 'PASS',
          fileName: firstFile.name,
          contentLength: content.length,
          looksLikeCSV: isCSV,
          preview: content.substring(0, 200),
          details: `Downloaded ${content.length} characters, CSV format: ${isCSV ? 'Yes' : 'No'}`
        });
        
        console.log(`✅ Downloaded file: ${firstFile.name} (${content.length} chars, CSV: ${isCSV})`);
        
      } else {
        results.tests.push({
          test: 'CSV Download',
          status: 'FAIL',
          fileName: firstFile.name,
          httpStatus: downloadResponse.status,
          details: `Cannot download file: HTTP ${downloadResponse.status}`
        });
      }
      
    } else {
      results.tests.push({
        test: 'CSV Download',
        status: 'SKIP',
        details: 'No files found to download'
      });
    }
    
  } catch (error) {
    results.tests.push({
      test: 'CSV Download',
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // Summary
  const passedTests = results.tests.filter(t => t.status === 'PASS').length;
  const totalTests = results.tests.length;
  const hasWorkingCSV = results.tests.some(t => t.test === 'CSV Download' && t.status === 'PASS' && t.looksLikeCSV);
  
  console.log(`🏁 API key test complete: ${passedTests}/${totalTests} tests passed`);
  
  return NextResponse.json({
    success: passedTests > 0,
    ...results,
    summary: {
      testsPass: passedTests,
      testsTotal: totalTests,
      hasWorkingCSV,
      diagnosis: hasWorkingCSV ? 'FULLY_WORKING' : 
                passedTests > 0 ? 'PARTIAL_SUCCESS' : 
                'API_KEY_ISSUES',
      nextSteps: getNextSteps(hasWorkingCSV, passedTests, totalTests)
    }
  });
}

function getNextSteps(hasWorkingCSV: boolean, passed: number, total: number): string[] {
  if (hasWorkingCSV) {
    return [
      '🎉 SUCCESS: Your API key is working perfectly!',
      '🔄 Your dashboard should now load CSV data automatically',
      '✅ All Google Drive access is properly configured',
      '🎯 If dashboard still shows no data, check browser console for errors'
    ];
  } else if (passed > 0) {
    return [
      '⚠️ API key works but CSV issues detected',
      '📁 Check if CSV files exist in your Google Drive folder',
      '📝 Ensure CSV files have format: Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C',
      '🆔 Verify CSV contains device ID: 88A29E218213'
    ];
  } else {
    return [
      '❌ API key has issues',
      '🔑 Verify API key is correct: ' + (process.env.GOOGLE_DRIVE_API_KEY?.substring(0, 20) || 'Not set'),
      '🌐 Check if API key has Google Drive API enabled',
      '📁 Ensure folder is publicly accessible or API key has permission'
    ];
  }
}