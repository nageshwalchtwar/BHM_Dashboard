import { NextResponse } from "next/server";
import { RealGoogleDriveReader } from '@/lib/real-drive-reader';
import { SimpleGoogleDriveReader, getLatestCSVSimple } from '@/lib/simple-drive-reader';

const FOLDER_ID = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';

export async function GET() {
  console.log('🧪 Testing Google Drive folder access...');
  
  const results = {
    folderId: FOLDER_ID,
    folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
    tests: [] as any[]
  };

  // Test 1: Real Google Drive Reader
  try {
    console.log('🎯 Testing RealGoogleDriveReader...');
    const realReader = new RealGoogleDriveReader(FOLDER_ID);
    const realResult = await realReader.getLatestRealCSV();
    
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: !!realResult,
      filename: realResult?.filename || null,
      contentLength: realResult?.content?.length || 0,
      hasExpectedFormat: realResult?.content?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: false,
      error: error.message
    });
  }

  // Test 2: Simple Google Drive Reader
  try {
    console.log('🔍 Testing SimpleGoogleDriveReader...');
    const simpleContent = await getLatestCSVSimple(FOLDER_ID);
    
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: !!simpleContent,
      contentLength: simpleContent?.length || 0,
      hasExpectedFormat: simpleContent?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: false,
      error: error.message
    });
  }

  return NextResponse.json(results);
}