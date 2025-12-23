import { NextResponse } from 'next/server';

// Simple diagnostic API to test Google Drive connection step by step
export async function GET() {
  const folderId = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
  const results = {
    timestamp: new Date().toISOString(),
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    steps: [] as any[]
  };

  console.log('🔧 Starting Google Drive connection diagnosis...');

  // Step 1: Basic internet connectivity
  try {
    console.log('Step 1: Testing internet connectivity...');
    const googleResponse = await fetch('https://www.google.com', { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    
    results.steps.push({
      step: 1,
      name: 'Internet Connectivity',
      status: googleResponse.ok ? 'PASS' : 'FAIL',
      details: googleResponse.ok ? 'Can reach google.com' : `HTTP ${googleResponse.status}`,
      critical: true
    });
  } catch (error) {
    results.steps.push({
      step: 1,
      name: 'Internet Connectivity', 
      status: 'FAIL',
      details: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
      critical: true
    });
  }

  // Step 2: Google Drive domain accessibility
  try {
    console.log('Step 2: Testing Google Drive domain...');
    const driveResponse = await fetch('https://drive.google.com', { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });
    
    results.steps.push({
      step: 2,
      name: 'Google Drive Domain',
      status: driveResponse.ok ? 'PASS' : 'FAIL',
      details: driveResponse.ok ? 'Drive domain accessible' : `HTTP ${driveResponse.status}`,
      critical: true
    });
  } catch (error) {
    results.steps.push({
      step: 2,
      name: 'Google Drive Domain',
      status: 'FAIL', 
      details: `Cannot reach drive.google.com: ${error instanceof Error ? error.message : 'Unknown'}`,
      critical: true
    });
  }

  // Step 3: Your specific folder accessibility 
  try {
    console.log('Step 3: Testing your folder URL...');
    const folderResponse = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    results.steps.push({
      step: 3,
      name: 'Your Folder Accessibility',
      status: folderResponse.ok ? 'PASS' : 'FAIL',
      details: folderResponse.ok 
        ? 'Folder is publicly accessible' 
        : `HTTP ${folderResponse.status} - Folder may be private`,
      critical: true,
      httpStatus: folderResponse.status
    });
  } catch (error) {
    results.steps.push({
      step: 3,
      name: 'Your Folder Accessibility',
      status: 'FAIL',
      details: `Folder access failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      critical: true
    });
  }

  // Step 4: Google Drive API availability
  try {
    console.log('Step 4: Testing Google Drive API...');
    const apiResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      signal: AbortSignal.timeout(10000)
    });
    
    results.steps.push({
      step: 4,
      name: 'Google Drive API',
      status: apiResponse.status === 401 ? 'PASS' : 'UNKNOWN', // 401 means API is there but needs auth
      details: apiResponse.status === 401 
        ? 'API available (401 = authentication required)' 
        : `API response: ${apiResponse.status}`,
      critical: false,
      httpStatus: apiResponse.status
    });
  } catch (error) {
    results.steps.push({
      step: 4,
      name: 'Google Drive API',
      status: 'FAIL',
      details: `API not reachable: ${error instanceof Error ? error.message : 'Unknown'}`,
      critical: false
    });
  }

  // Step 5: File listing attempt (no auth)
  try {
    console.log('Step 5: Testing file listing without auth...');
    const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents`, {
      signal: AbortSignal.timeout(10000)
    });
    
    results.steps.push({
      step: 5,
      name: 'File Listing (No Auth)',
      status: listResponse.status === 401 ? 'EXPECTED' : listResponse.ok ? 'UNEXPECTED_SUCCESS' : 'FAIL',
      details: listResponse.status === 401 
        ? 'Expected: Authentication required for file listing'
        : listResponse.ok 
        ? 'Unexpected: Files accessible without authentication'
        : `File listing failed: HTTP ${listResponse.status}`,
      critical: false,
      httpStatus: listResponse.status
    });
  } catch (error) {
    results.steps.push({
      step: 5,
      name: 'File Listing (No Auth)',
      status: 'FAIL',
      details: `File listing error: ${error instanceof Error ? error.message : 'Unknown'}`,
      critical: false
    });
  }

  // Step 6: Try direct file access patterns
  const currentTime = new Date();
  const patterns = [];
  
  // Generate recent file patterns
  for (let hoursAgo = 0; hoursAgo < 3; hoursAgo++) {
    const testTime = new Date(currentTime.getTime() - (hoursAgo * 60 * 60 * 1000));
    const pattern = `${testTime.getFullYear()}-${String(testTime.getMonth() + 1).padStart(2, '0')}-${String(testTime.getDate()).padStart(2, '0')}_${String(testTime.getHours()).padStart(2, '0')}-${String(Math.floor(testTime.getMinutes() / 10) * 10).padStart(2, '0')}`;
    patterns.push(pattern);
  }

  let fileTestResults = [];
  for (const pattern of patterns) {
    try {
      console.log(`Step 6: Testing file pattern ${pattern}...`);
      
      // Try different CSV access URLs
      const testUrls = [
        `https://docs.google.com/spreadsheets/d/${folderId}/export?format=csv&gid=0`,
        `https://drive.google.com/uc?id=${folderId}&export=download`,
      ];
      
      for (const testUrl of testUrls) {
        try {
          const response = await fetch(testUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)'
            },
            signal: AbortSignal.timeout(15000)
          });
          
          if (response.ok) {
            const content = await response.text();
            
            fileTestResults.push({
              pattern,
              url: testUrl,
              status: 'SUCCESS',
              contentLength: content.length,
              hasCSVHeaders: content.includes('Device,Timestamp') || content.includes('CSV'),
              preview: content.substring(0, 100)
            });
            
            // If we found CSV content, we can stop testing more patterns
            if (content.includes('Device,Timestamp')) {
              break;
            }
          } else {
            fileTestResults.push({
              pattern,
              url: testUrl,
              status: 'FAIL',
              httpStatus: response.status,
              statusText: response.statusText
            });
          }
        } catch (urlError) {
          fileTestResults.push({
            pattern,
            url: testUrl,
            status: 'ERROR',
            error: urlError instanceof Error ? urlError.message : 'Unknown'
          });
        }
      }
    } catch (error) {
      // Continue to next pattern
    }
  }

  results.steps.push({
    step: 6,
    name: 'File Pattern Testing',
    status: fileTestResults.some(r => r.status === 'SUCCESS') ? 'PASS' : 'FAIL',
    details: `Tested ${patterns.length} recent time patterns`,
    results: fileTestResults,
    critical: true
  });

  // Overall diagnosis
  const criticalFailures = results.steps.filter(step => step.critical && step.status === 'FAIL');
  const hasWorkingFileAccess = fileTestResults.some(r => r.status === 'SUCCESS' && r.hasCSVHeaders);
  
  const diagnosis = criticalFailures.length > 0 
    ? 'CONNECTION_ISSUES'
    : hasWorkingFileAccess 
    ? 'WORKING' 
    : 'NO_CSV_ACCESS';

  console.log(`🏁 Diagnosis complete: ${diagnosis}`);

  return NextResponse.json({
    ...results,
    diagnosis,
    summary: {
      totalSteps: results.steps.length,
      criticalFailures: criticalFailures.length,
      hasFileAccess: hasWorkingFileAccess,
      recommendations: getRecommendations(diagnosis, criticalFailures, hasWorkingFileAccess)
    }
  });
}

function getRecommendations(diagnosis: string, criticalFailures: any[], hasFileAccess: boolean): string[] {
  switch (diagnosis) {
    case 'CONNECTION_ISSUES':
      return [
        '🌐 Check your internet connection',
        '🔥 Check if firewall is blocking Google Drive',
        '🔄 Try again in a few minutes (temporary network issues)',
        '📱 Test by opening the folder URL in your browser manually'
      ];
      
    case 'NO_CSV_ACCESS':
      return [
        '📁 Ensure CSV files exist in your Google Drive folder',
        '🔓 Make sure folder is shared as "Anyone with link can view"',
        '📝 Check CSV files have correct naming: YYYY-MM-DD_HH-MM.csv',
        '📋 Verify CSV header: Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C',
        '⏰ Upload a fresh CSV file with current timestamp'
      ];
      
    case 'WORKING':
      return [
        '✅ Connection is working!',
        '🔄 Try refreshing your dashboard',
        '🕐 Data should appear within a few seconds',
        '🔍 If still no data, check browser console for errors'
      ];
      
    default:
      return [
        '❓ Unclear issue - check individual step results above',
        '🛠️ Consider using Google Drive API key for more reliable access'
      ];
  }
}