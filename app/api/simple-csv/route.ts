import { NextResponse } from 'next/server';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
const API_KEY = 'AIzaSyAUrHYasTzocaLJa50ZKsM20r5NizVrtU8';

export async function GET() {
  console.log('📄 Fetching latest CSV from Google Drive folder...');

  try {
    // Step 1: Get list of files in the folder, ordered by modified time (newest first)
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=parents in '${FOLDER_ID}' and mimeType='text/csv'&orderBy=modifiedTime desc&key=${API_KEY}&fields=files(id,name,modifiedTime)`;
    
    console.log('🔍 Listing files in folder...');
    
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    console.log('📋 List response:', listData);
    
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
        error: 'No CSV files found in the specified folder',
        debug: { listData }
      });
    }
    
    // Step 2: Get the latest file (first in the ordered list)
    const latestFile = listData.files[0];
    console.log('📊 Latest file:', latestFile.name, 'Modified:', latestFile.modifiedTime);
    
    // Step 3: Download the latest CSV file content
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${API_KEY}`;
    
    console.log('⬇️ Downloading CSV content...');
    
    const csvResponse = await fetch(downloadUrl);
    
    if (!csvResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`,
        debug: { 
          fileId: latestFile.id,
          fileName: latestFile.name,
          downloadUrl: downloadUrl.replace(API_KEY, '[API_KEY]')
        }
      });
    }
    
    const csvContent = await csvResponse.text();
    console.log('✅ Downloaded CSV content:', csvContent.length, 'characters');
    
    // Return raw CSV content for the frontend to parse
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