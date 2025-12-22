import { NextResponse } from 'next/server';

// Emergency simple CSV fetch - bypasses all authentication complexity
export async function GET() {
  const folderId = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
  
  console.log('🚨 Emergency CSV fetch - testing simplest possible access...');
  
  // Try the absolute simplest methods first
  const testMethods = [
    {
      name: 'Direct Folder as Spreadsheet',
      url: `https://docs.google.com/spreadsheets/d/${folderId}/export?format=csv&gid=0`
    },
    {
      name: 'Drive Download Link',
      url: `https://drive.google.com/uc?id=${folderId}&export=download`
    },
    {
      name: 'Direct File ID Test',
      url: `https://docs.google.com/spreadsheets/d/${folderId}/gviz/tq?tqx=out:csv`
    }
  ];

  const results = [];
  
  for (const method of testMethods) {
    try {
      console.log(`🧪 Testing: ${method.name}`);
      
      const response = await fetch(method.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(20000) // 20 second timeout
      });
      
      console.log(`📊 ${method.name} - Status: ${response.status}`);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`📄 ${method.name} - Content length: ${content.length}`);
        
        // Check for various CSV indicators
        const isCSV = content.includes(',') && 
                     (content.includes('Device') || 
                      content.includes('Timestamp') || 
                      content.includes('88A29E218213') ||
                      content.split('\n').length > 1);
        
        results.push({
          method: method.name,
          status: 'SUCCESS',
          url: method.url,
          contentLength: content.length,
          looksLikeCSV: isCSV,
          preview: content.substring(0, 200),
          lines: content.split('\n').length,
          hasDeviceColumn: content.includes('Device'),
          hasTimestampColumn: content.includes('Timestamp'),
          hasExpectedDevice: content.includes('88A29E218213')
        });
        
        // If we found CSV-like content, return immediately
        if (isCSV) {
          console.log(`✅ Found CSV content with ${method.name}!`);
          break;
        }
        
      } else {
        results.push({
          method: method.name,
          status: 'HTTP_ERROR',
          url: method.url,
          httpStatus: response.status,
          statusText: response.statusText
        });
      }
      
    } catch (error) {
      console.error(`❌ ${method.name} failed:`, error);
      results.push({
        method: method.name,
        status: 'NETWORK_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Summary
  const successfulMethods = results.filter(r => r.status === 'SUCCESS');
  const csvMethods = results.filter(r => r.status === 'SUCCESS' && r.looksLikeCSV);
  
  const diagnosis = csvMethods.length > 0 ? 'CSV_FOUND' : 
                   successfulMethods.length > 0 ? 'NO_CSV_CONTENT' : 
                   'ALL_METHODS_FAILED';
  
  console.log(`🏁 Emergency test complete: ${diagnosis}`);
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    diagnosis,
    results,
    summary: {
      totalMethods: testMethods.length,
      successfulConnections: successfulMethods.length,
      foundCSV: csvMethods.length > 0,
      recommendations: getEmergencyRecommendations(diagnosis, results)
    }
  });
}

function getEmergencyRecommendations(diagnosis: string, results: any[]): string[] {
  switch (diagnosis) {
    case 'CSV_FOUND':
      return [
        '🎉 SUCCESS: CSV content found!',
        '🔄 Your dashboard should be working now',
        '🔍 If dashboard still shows no data, check browser console for errors',
        '⏰ Make sure CSV files have recent timestamps'
      ];
      
    case 'NO_CSV_CONTENT':
      return [
        '🌐 Connection works but no CSV content found',
        '📁 Check if your folder actually contains CSV files',
        '📝 Make sure CSV files have headers: Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C',
        '🆔 Verify CSV contains device ID: 88A29E218213'
      ];
      
    case 'ALL_METHODS_FAILED':
      return [
        '❌ All connection methods failed',
        '🔓 Make sure folder is shared as "Anyone with link can view"',
        '🔄 Try again in a few minutes (might be temporary)',
        '🌐 Check your internet connection',
        '🔑 Consider getting a Google Drive API key for reliable access'
      ];
      
    default:
      return ['❓ Unknown diagnosis - check results above'];
  }
}