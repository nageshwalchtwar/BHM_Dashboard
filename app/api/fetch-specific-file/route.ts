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
      console.log(`Found ${allFiles.length} files in folder`);
      
      // More flexible filename matching
      const targetFile = allFiles.find(file => {
        const fileBaseName = file.name.replace('.csv', '');
        const searchBaseName = fileName.replace('.csv', '');
        
        return file.name === fileName || 
               file.name === `${fileName}.csv` ||
               fileBaseName === searchBaseName ||
               file.name.includes(searchBaseName) ||
               searchBaseName.includes(fileBaseName);
      });
      
      if (targetFile) {
        console.log(`✅ Found matching file: ${targetFile.name}`);
        csvContent = await realReader.readFile(targetFile.id);
        fetchMethod = 'RealGoogleDriveReader';
      } else {
        console.log(`❌ No matching file found for: ${fileName}`);
        console.log('Available files:', allFiles.map(f => f.name));
      }
    } catch (error) {
      console.log('⚠️ RealGoogleDriveReader failed:', error);
    }
    
    // Method 2: If no specific file found, just get the latest file
    if (!csvContent) {
      try {
        console.log('🔄 Fallback: Getting latest CSV file...');
        const realReader = new RealGoogleDriveReader(FOLDER_ID);
        const result = await realReader.getLatestRealCSV();
        
        if (result && result.content) {
          csvContent = result.content;
          fetchMethod = 'RealGoogleDriveReader (latest)';
          console.log(`✅ Got latest file: ${result.filename}`);
        }
      } catch (error) {
        console.log('⚠️ Latest file fetch failed:', error);
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
    console.log(`📊 Parsing CSV content (${csvContent.length} characters)...`);
    const parsedData = parseCSVToSensorData(csvContent);
    
    if (parsedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid sensor data found',
        message: 'CSV was fetched but contains no parseable sensor data',
        contentSample: csvContent.substring(0, 300)
      }, { status: 400 });
    }
    
    // Sort by timestamp (newest first)
    parsedData.sort((a, b) => b.timestamp - a.timestamp);
    console.log(`✅ Sorted ${parsedData.length} data points by timestamp`);
    
    // Get only the latest 1 minute of data (60 seconds)
    const latestTimestamp = parsedData[0].timestamp;
    const oneMinuteAgo = latestTimestamp - (60 * 1000); // 1 minute = 60,000 milliseconds
    const recentData = parsedData.filter(point => point.timestamp >= oneMinuteAgo);
    
    console.log(`📈 Latest data: ${recentData.length} points from last minute`);
    console.log(`⏰ Time range: ${new Date(oneMinuteAgo).toLocaleTimeString()} - ${new Date(latestTimestamp).toLocaleTimeString()}`);
    
    return NextResponse.json({
      success: true,
      data: recentData,
      metadata: {
        fileName,
        fetchMethod,
        totalDataPoints: parsedData.length,
        recentDataPoints: recentData.length,
        latestTimestamp: new Date(latestTimestamp).toLocaleString(),
        timeRange: `${new Date(oneMinuteAgo).toLocaleTimeString()} - ${new Date(latestTimestamp).toLocaleTimeString()}`,
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