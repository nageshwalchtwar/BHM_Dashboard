import { NextRequest, NextResponse } from 'next/server';
import { RealGoogleDriveReader } from '@/lib/real-drive-reader';
import { SimpleGoogleDriveReader, getLatestCSVSimple } from '@/lib/simple-drive-reader';
import { DriveDirectAccess } from '@/lib/drive-scraper';
import { parseCSVToSensorData, getRecentData } from '@/lib/csv-handler';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    
    console.log(`🎯 User selected: ${fileName}, fetching latest CSV data...`);
    
    // Simplified approach: Just get the latest CSV file regardless of which one was selected
    let csvContent = '';
    let fetchMethod = '';
    let actualFileName = fileName;
    
    // Try RealGoogleDriveReader first
    try {
      console.log('🔄 Getting latest CSV from RealGoogleDriveReader...');
      const realReader = new RealGoogleDriveReader(FOLDER_ID);
      const result = await realReader.getLatestRealCSV();
      
      if (result && result.content && result.content.length > 100) {
        csvContent = result.content;
        fetchMethod = 'RealGoogleDriveReader';
        actualFileName = result.filename;
        console.log(`✅ Got CSV content: ${result.filename} (${csvContent.length} chars)`);
      }
    } catch (error) {
      console.log('⚠️ RealGoogleDriveReader failed:', error);
    }
    
    // Fallback to SimpleGoogleDriveReader
    if (!csvContent) {
      try {
        console.log('🔄 Trying SimpleGoogleDriveReader...');
        csvContent = await getLatestCSVSimple(FOLDER_ID);
        if (csvContent && csvContent.length > 100) {
          fetchMethod = 'SimpleGoogleDriveReader';
          console.log(`✅ Got CSV content via SimpleReader (${csvContent.length} chars)`);
        }
      } catch (error) {
        console.log('⚠️ SimpleGoogleDriveReader failed:', error);
      }
    }
    
    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: `Could not fetch any CSV content from Google Drive`,
        debug: {
          requestedFile: fileName,
          folderId: FOLDER_ID,
          folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`
        }
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
        requestedFile: fileName,
        actualFile: actualFileName,
        fetchMethod,
        totalDataPoints: parsedData.length,
        recentDataPoints: recentData.length,
        latestTimestamp: new Date(latestTimestamp).toLocaleString(),
        timeRange: `${new Date(oneMinuteAgo).toLocaleTimeString()} - ${new Date(latestTimestamp).toLocaleTimeString()}`,
        source: 'latest-available-file'
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