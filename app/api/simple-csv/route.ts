import { NextResponse } from 'next/server';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
const API_KEY = 'AIzaSyBlwJphSwxTpoUX2Bxfrmvooc6xs6jl6J8';

// Cache to reduce Railway usage - cache data for 30 minutes (AGGRESSIVE COST SAVING)
let lastFetchTime = 0;
let cachedData: any = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

export async function GET() {
  console.log('📄 Fetching CSV (Railway ULTRA-OPTIMIZED - 30min cache)...');

  try {
    // Check cache first to reduce API calls and save Railway costs
    const now = Date.now();
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('🚀 Returning cached data (saves Railway usage)');
      return NextResponse.json({
        ...cachedData,
        cached: true,
        cacheAge: Math.floor((now - lastFetchTime) / 1000) + 's'
      });
    }

    console.log('🔍 Cache expired, fetching fresh data...');
    // Method 1: Try with publicly accessible folder
    console.log('🔍 Method 1: Google Drive API with public folder...');
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=parents in '${FOLDER_ID}' and trashed=false&orderBy=modifiedTime desc&key=${API_KEY}&fields=files(id,name,modifiedTime,size)`;
    
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    console.log('📋 API Response:', JSON.stringify(listData, null, 2));
    
    if (listResponse.ok && listData.files && listData.files.length > 0) {
      const latestFile = listData.files[0];
      console.log('📊 Latest file:', latestFile.name, 'Modified:', latestFile.modifiedTime);
      
      // Try to download the file
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${API_KEY}`;
      
      console.log('⬇️ Downloading CSV content...');
      
      const csvResponse = await fetch(downloadUrl);
      
      if (csvResponse.ok) {
        const csvContent = await csvResponse.text();
        console.log('✅ Successfully downloaded CSV:', csvContent.length, 'characters');
        
        return NextResponse.json({
          success: true,
          data: csvContent,
          fileName: latestFile.name,
          modifiedTime: latestFile.modifiedTime,
          debug: {
            method: 'Google Drive API',
            fileId: latestFile.id,
            fileName: latestFile.name,
            fileSize: latestFile.size,
            totalFiles: listData.files.length
          }
        });
      } else {
        console.log('❌ Download failed:', csvResponse.status, csvResponse.statusText);
      }
    }
    
    // Method 2: Try alternative folder access
    console.log('🔄 Method 2: Alternative folder access...');
    
    // Try direct folder export (sometimes works for public folders)
    const exportMethods = [
      `https://drive.google.com/uc?id=${FOLDER_ID}&export=download`,
      `https://docs.google.com/spreadsheets/d/${FOLDER_ID}/export?format=csv&gid=0`
    ];
    
    for (const exportUrl of exportMethods) {
      try {
        console.log('🎯 Trying export method:', exportUrl);
        const exportResponse = await fetch(exportUrl);
        
        if (exportResponse.ok) {
          const content = await exportResponse.text();
          
          // Check if it looks like valid CSV
          if (content && content.includes('Device,Timestamp') && !content.includes('<html>')) {
            console.log('✅ Success with export method');
            
            return NextResponse.json({
              success: true,
              data: content,
              fileName: 'exported-data.csv',
              modifiedTime: new Date().toISOString(),
              debug: {
                method: 'Export method',
                exportUrl: exportUrl,
                contentLength: content.length
              }
            });
          }
        }
      } catch (exportError) {
        console.log('❌ Export method failed:', exportError);
        continue;
      }
    }
    
    // If we get here, provide detailed error information
    return NextResponse.json({
      success: false,
      error: 'Cannot access folder. Please check sharing settings.',
      detailedError: listData.error?.message || 'Permission denied',
      instructions: {
        step1: 'Go to your Google Drive folder',
        step2: 'Right-click on the folder (not inside it)',
        step3: 'Click "Share"',
        step4: 'Click "Change to anyone with the link"',
        step5: 'Set permission to "Viewer"',
        step6: 'Click "Done"',
        alternative: 'Or share individual CSV files and provide file IDs'
      },
      debug: {
        folderId: FOLDER_ID,
        folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
        apiResponse: listData,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching CSV:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debug: { 
        folderId: FOLDER_ID,
        error: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString()
      }
    });
  }
}