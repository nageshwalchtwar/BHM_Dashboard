import { NextRequest, NextResponse } from 'next/server';
import { RealGoogleDriveReader } from '@/lib/real-drive-reader';
import { SimpleGoogleDriveReader, getLatestCSVSimple } from '@/lib/simple-drive-reader';
import { DriveDirectAccess } from '@/lib/drive-scraper';
import { parseCSVToSensorData, getRecentData } from '@/lib/csv-handler';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({
        success: false,
        error: 'No file name provided'
      }, { status: 400 });
    }

    console.log(`🎯 Fetching specific file: ${fileName}`);
    
    // Try different readers to get the specific file content
    let csvContent = '';
    let fetchMethod = '';
    
    // Method 1: Try RealGoogleDriveReader
    try {
      console.log('🔄 Trying RealGoogleDriveReader...');
      const realReader = new RealGoogleDriveReader(FOLDER_ID);
      
      // Get all files and find the one matching the filename
      const allFiles = await realReader.listFiles();
      const targetFile = allFiles.find(file => 
        file.name === fileName || 
        file.name.includes(fileName) ||
        fileName.includes(file.name.replace('.csv', ''))
      );
      
      if (targetFile) {
        console.log(`✅ Found file: ${targetFile.name}`);
        csvContent = await realReader.readFile(targetFile.id);
        fetchMethod = 'RealGoogleDriveReader';
      }
    } catch (error) {
      console.log('⚠️ RealGoogleDriveReader failed:', error);
    }
    
    // Method 2: Try SimpleGoogleDriveReader if first method failed
    if (!csvContent) {
      try {
        console.log('🔄 Trying SimpleGoogleDriveReader...');
        csvContent = await getLatestCSVSimple(FOLDER_ID);
        if (csvContent) {
          fetchMethod = 'SimpleGoogleDriveReader';
        }
      } catch (error) {
        console.log('⚠️ SimpleGoogleDriveReader failed:', error);
      }
    }
    
    // Method 3: Try DriveDirectAccess if other methods failed
    if (!csvContent) {
      try {
        console.log('🔄 Trying DriveDirectAccess...');
        const driveAccess = new DriveDirectAccess(FOLDER_ID);
        const files = await driveAccess.listFiles();
        const targetFile = files.find(file => 
          file.name === fileName || 
          file.name.includes(fileName) ||
          fileName.includes(file.name.replace('.csv', ''))
        );
        
        if (targetFile) {
          csvContent = await driveAccess.readFileContent(targetFile.id);
          fetchMethod = 'DriveDirectAccess';
        }
      } catch (error) {
        console.log('⚠️ DriveDirectAccess failed:', error);
      }
    }
    
    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: `Could not fetch content for file: ${fileName}`,
        suggestion: 'Please try the manual process by copying and pasting the file content'
      }, { status: 404 });
    }
    
    // Validate CSV format
    if (!csvContent.includes('Device') || !csvContent.includes('Timestamp')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid CSV format',
        message: 'Expected columns: Device, Timestamp, X, Y, Z, Stroke_mm, Temperature_C',
        receivedContent: csvContent.substring(0, 200) + '...'
      }, { status: 400 });
    }
    
    // Parse the CSV content
    const parsedData = parseCSVToSensorData(csvContent);
    
    if (parsedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid sensor data found',
        message: 'CSV was fetched but contains no parseable sensor data'
      }, { status: 400 });
    }
    
    // Get recent data (last 1 minute by default)
    const recentData = getRecentData(parsedData, 1);
    
    return NextResponse.json({
      success: true,
      data: recentData,
      metadata: {
        fileName,
        fetchMethod,
        totalDataPoints: parsedData.length,
        recentDataPoints: recentData.length,
        latestTimestamp: recentData[recentData.length - 1]?.timestamp,
        source: 'specific-file-fetch'
      }
    });
    
  } catch (error) {
    console.error('File fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}