import { NextResponse } from 'next/server';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
const API_KEY = 'AIzaSyAUrHYasTzocaLJa50ZKsM20r5NizVrtU8';

export async function GET() {
  console.log('📄 Fetching latest CSV from Google Drive folder...');

  try {
    // Method 1: Try to list files in folder (requires public access or proper permissions)
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=parents in '${FOLDER_ID}' and mimeType='text/csv'&orderBy=modifiedTime desc&key=${API_KEY}&fields=files(id,name,modifiedTime)`;
    
    console.log('🔍 Listing files in folder...');
    
    try {
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();
      
      console.log('📋 List response:', listData);
      
      if (listResponse.ok && listData.files && listData.files.length > 0) {
        // Success! Get the latest file
        const latestFile = listData.files[0];
        console.log('📊 Latest file:', latestFile.name, 'Modified:', latestFile.modifiedTime);
        
        // Download the latest CSV file content
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${API_KEY}`;
        
        console.log('⬇️ Downloading CSV content...');
        
        const csvResponse = await fetch(downloadUrl);
        
        if (csvResponse.ok) {
          const csvContent = await csvResponse.text();
          console.log('✅ Downloaded CSV content:', csvContent.length, 'characters');
          
          return NextResponse.json({
            success: true,
            data: csvContent,
            fileName: latestFile.name,
            modifiedTime: latestFile.modifiedTime,
            method: 'Google Drive API',
            debug: {
              fileId: latestFile.id,
              fileName: latestFile.name,
              modifiedTime: latestFile.modifiedTime,
              dataLength: csvContent.length,
              totalFiles: listData.files.length
            }
          });
        }
      }
    } catch (apiError) {
      console.log('❌ API method failed:', apiError);
    }

    // Method 2: Try direct public folder access methods as fallback
    console.log('🔄 Trying alternative access methods...');
    
    const alternativeMethods = [
      // Try folder as shared spreadsheet
      `https://docs.google.com/spreadsheets/d/${FOLDER_ID}/export?format=csv&gid=0`,
      // Try direct drive download
      `https://drive.google.com/uc?id=${FOLDER_ID}&export=download`,
      // Try alternative export
      `https://docs.google.com/spreadsheets/d/${FOLDER_ID}/gviz/tq?tqx=out:csv`
    ];

    for (const method of alternativeMethods) {
      try {
        console.log(`🔍 Trying: ${method}`);
        
        const response = await fetch(method, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Dashboard/1.0)'
          }
        });

        if (response.ok) {
          const content = await response.text();
          
          // Check if it looks like CSV data
          if (content && content.length > 50 && content.includes(',') && !content.includes('<html')) {
            console.log('✅ Found CSV via alternative method:', content.length, 'characters');
            
            return NextResponse.json({
              success: true,
              data: content,
              fileName: 'latest.csv',
              modifiedTime: new Date().toISOString(),
              method: 'Alternative access',
              debug: {
                method: method,
                dataLength: content.length
              }
            });
          }
        }
      } catch (methodError) {
        console.log(`❌ Method failed: ${methodError}`);
        continue;
      }
    }
    
    // If all methods failed
    return NextResponse.json({
      success: false,
      error: 'Unable to access folder. Please make sure the folder is shared publicly with "Anyone with the link can view" permission.',
      suggestions: [
        '1. Go to your Google Drive folder',
        '2. Right-click → Share',
        '3. Change to "Anyone with the link"', 
        '4. Set permission to "Viewer"',
        '5. Click Done'
      ],
      debug: { 
        folderId: FOLDER_ID,
        folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching latest CSV:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debug: { 
        folderId: FOLDER_ID,
        error: error instanceof Error ? error.stack : String(error) 
      }
    });
  }
}