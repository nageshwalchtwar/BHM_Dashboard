import { NextRequest, NextResponse } from 'next/server';
import { RealGoogleDriveReader, SimpleGoogleDriveReader, DriveDirectAccess } from '@/lib/google-drive-reader';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

async function testReader(ReaderClass: any, name: string, folderId: string) {
  try {
    console.log(`Testing ${name}...`);
    const reader = new ReaderClass(folderId);
    
    const files = await reader.listFiles();
    console.log(`${name} found ${files.length} files`);
    
    if (files.length > 0) {
      const latestFile = files[0];
      console.log(`${name} latest file:`, latestFile.name);
      
      const data = await reader.readFile(latestFile.id);
      console.log(`${name} data sample:`, data.slice(0, 2));
      
      return {
        success: true,
        method: name,
        filesCount: files.length,
        latestFile: latestFile.name,
        dataSample: data.slice(0, 2)
      };
    } else {
      return {
        success: false,
        method: name,
        error: 'No files found'
      };
    }
  } catch (error) {
    return {
      success: false,
      method: name,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET() {
  const results = [];
  
  // Test all three readers
  const readers = [
    { class: RealGoogleDriveReader, name: 'RealGoogleDriveReader' },
    { class: SimpleGoogleDriveReader, name: 'SimpleGoogleDriveReader' },
    { class: DriveDirectAccess, name: 'DriveDirectAccess' }
  ];
  
  for (const { class: ReaderClass, name } of readers) {
    const result = await testReader(ReaderClass, name, FOLDER_ID);
    results.push(result);
  }
  
  return NextResponse.json({
    folderId: FOLDER_ID,
    results
  });
}