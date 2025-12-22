import { NextResponse } from 'next/server';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
const API_KEY = 'AIzaSyBlwJphSwxTpoUX2Bxfrmvooc6xs6jl6J8';

export async function GET() {
  console.log('📄 Fetching latest CSV from Google Drive folder...');

  try {
    // Get list of files in folder, ordered by modified time (newest first)
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=parents in '${FOLDER_ID}'&orderBy=modifiedTime desc&key=${API_KEY}&fields=files(id,name,modifiedTime)`;
    
    console.log('🔍 Listing files in folder...');
    
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    console.log('📋 API Response:', listData);
    
    if (!listResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to list files: ${listData.error?.message || 'Unknown error'}`,
        debug: { listData }
      });
    }
    
    if (!listData.files || listData.files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files found in the specified folder',
        debug: { listData }
      });
    }
    
    // Get the latest file (first in the ordered list)
    const latestFile = listData.files[0];
    console.log('📊 Latest file:', latestFile.name, 'Modified:', latestFile.modifiedTime);
    
    // Download the latest CSV file content
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${API_KEY}`;
    
    console.log('⬇️ Downloading CSV content...');
    
    const csvResponse = await fetch(downloadUrl);
    
    if (!csvResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`,
        debug: { 
          fileId: latestFile.id,
          fileName: latestFile.name
        }
      });
    }
    
    const csvContent = await csvResponse.text();
    console.log('✅ Successfully downloaded CSV:', csvContent.length, 'characters');
    
    return NextResponse.json({
      success: true,
      data: csvContent,
      fileName: latestFile.name,
      modifiedTime: latestFile.modifiedTime,
      debug: {
        fileId: latestFile.id,
        fileName: latestFile.name,
        modifiedTime: latestFile.modifiedTime,
        dataLength: csvContent.length,
        totalFiles: listData.files.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching CSV:', error);
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