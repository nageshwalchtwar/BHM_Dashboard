import { NextResponse } from 'next/server';

// Direct test of your Google Drive folder accessibility
export async function GET() {
  const folderId = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
  
  console.log('🧪 Direct Google Drive folder test...');
  
  const tests = [];

  // Test 1: Check if folder is publicly accessible
  try {
    console.log('🌐 Testing direct folder access...');
    const folderResponse = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
      method: 'HEAD', // Just check if accessible
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)'
      }
    });
    
    tests.push({
      test: 'Folder Public Access',
      success: folderResponse.ok,
      status: folderResponse.status,
      message: folderResponse.ok ? 'Folder is accessible' : `HTTP ${folderResponse.status} - Folder may not be public`
    });
  } catch (error) {
    tests.push({
      test: 'Folder Public Access',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Try Google Drive API without authentication
  try {
    console.log('🔍 Testing Google Drive API (no auth)...');
    const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&orderBy=modifiedTime desc`;
    const apiResponse = await fetch(apiUrl);
    
    tests.push({
      test: 'Google Drive API (No Auth)',
      success: apiResponse.ok,
      status: apiResponse.status,
      message: apiResponse.ok ? 'API accessible without auth' : `HTTP ${apiResponse.status} - Authentication required`
    });
  } catch (error) {
    tests.push({
      test: 'Google Drive API (No Auth)',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Try common CSV file patterns
  const currentTime = new Date();
  const testPatterns = [];
  
  // Generate some recent time patterns
  for (let hoursAgo = 0; hoursAgo < 5; hoursAgo++) {
    const testTime = new Date(currentTime.getTime() - (hoursAgo * 60 * 60 * 1000));
    const pattern = `${testTime.getFullYear()}-${String(testTime.getMonth() + 1).padStart(2, '0')}-${String(testTime.getDate()).padStart(2, '0')}_${String(testTime.getHours()).padStart(2, '0')}-${String(testTime.getMinutes()).padStart(2, '0')}`;
    testPatterns.push(pattern);
  }

  for (const pattern of testPatterns.slice(0, 3)) {
    try {
      console.log(`📄 Testing CSV pattern: ${pattern}`);
      
      // Try different CSV access methods
      const csvUrls = [
        `https://docs.google.com/spreadsheets/d/${folderId}/export?format=csv&gid=${pattern}`,
        `https://drive.google.com/uc?id=${folderId}&export=download&format=csv&sheet=${pattern}`,
      ];

      let foundCsv = false;
      for (const csvUrl of csvUrls) {
        try {
          const csvResponse = await fetch(csvUrl);
          if (csvResponse.ok) {
            const content = await csvResponse.text();
            if (content.includes('Device,Timestamp') || content.includes('CSV')) {
              foundCsv = true;
              tests.push({
                test: `CSV File Pattern: ${pattern}`,
                success: true,
                url: csvUrl,
                contentLength: content.length,
                message: `Found CSV content (${content.length} chars)`
              });
              break;
            }
          }
        } catch {
          // Continue to next URL
        }
      }

      if (!foundCsv) {
        tests.push({
          test: `CSV File Pattern: ${pattern}`,
          success: false,
          message: 'No CSV content found for this pattern'
        });
      }
    } catch (error) {
      tests.push({
        test: `CSV File Pattern: ${pattern}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  const successfulTests = tests.filter(test => test.success);
  
  return NextResponse.json({
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      totalTests: tests.length,
      successfulTests: successfulTests.length,
      diagnosis: successfulTests.length === 0 
        ? 'FOLDER_NOT_PUBLIC' 
        : successfulTests.length < tests.length 
        ? 'PARTIAL_ACCESS' 
        : 'FULL_ACCESS',
      nextSteps: successfulTests.length === 0 
        ? [
          '1. Open your Google Drive folder: https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai',
          '2. Right-click → Share → Change to "Anyone with the link can view"',
          '3. Make sure CSV files exist in the folder',
          '4. Or get a Google Drive API key for private access'
        ]
        : [
          '✅ Some access methods work!',
          'Data should be loading in your dashboard'
        ]
    }
  });
}