import { NextRequest, NextResponse } from 'next/server';
import { parseCSVToSensorData } from '@/lib/csv-handler';
import { SecureGoogleDriveReader, getLatestCSVFromPublicFolder } from '@/lib/secure-drive-reader';
import { accessSharedGoogleDriveFolder } from '@/lib/direct-drive-access';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    console.log(`🎯 Accessing your real Google Drive folder for: ${fileName || 'latest'}`);
    console.log(`📂 Folder: https://drive.google.com/drive/folders/${FOLDER_ID}`);
    
    let csvContent = '';
    let fetchMethod = '';
    let actualFileName = fileName || 'latest';
    
    // Method 1: Try direct access to your shared folder
    try {
      console.log('🔗 Trying direct access to your shared folder...');
      const result = await accessSharedGoogleDriveFolder();
      
      if (result && result.content && result.content.length > 100) {
        csvContent = result.content;
        fetchMethod = 'DirectSharedFolderAccess';
        actualFileName = result.filename;
        console.log(`✅ Got real data from your folder: ${result.filename} (${csvContent.length} chars)`);
      }
    } catch (error) {
      console.log('⚠️ Direct folder access failed:', error);
    }
    
    // Method 1: Try secure Google Drive API
    try {
      console.log('🔐 Trying secure Google Drive API access...');
      const secureReader = new SecureGoogleDriveReader(FOLDER_ID);
      const result = await secureReader.getLatestCSVFile();
      
      if (result && result.content && result.content.length > 100) {
        csvContent = result.content;
        fetchMethod = 'SecureGoogleDriveAPI';
        actualFileName = result.filename;
        console.log(`✅ Got real CSV: ${result.filename} (${csvContent.length} chars)`);
      }
    } catch (error) {
      console.log('⚠️ Secure API failed:', error);
    }
    
    // Method 2: Try public folder access
    if (!csvContent) {
      try {
        console.log('🌐 Trying public folder access...');
        csvContent = await getLatestCSVFromPublicFolder();
        if (csvContent && csvContent.length > 100) {
          fetchMethod = 'PublicFolderAccess';
          console.log(`✅ Got content via public access (${csvContent.length} chars)`);
        }
      } catch (error) {
        console.log('⚠️ Public access failed:', error);
      }
    }
    
    // Method 3: Fallback to sample data if no real data available
    if (!csvContent) {
      console.log('📊 Using sample data as fallback...');
      
      const currentTime = new Date();
      const sampleRows = [];
      
      // Generate realistic sample data based on your format
      for (let i = 0; i < 15; i++) {
        const timestamp = new Date(currentTime.getTime() - (i * 4000)); // 4 seconds apart
        const timeStr = timestamp.toTimeString().split(' ')[0]; // HH:MM:SS format
        
        // Use realistic sensor values similar to your example
        const baseX = 23.875 + (Math.random() - 0.5) * 0.1;
        const baseY = 0.1780546875 + (Math.random() - 0.5) * 0.01;
        const baseZ = 0.0019921875 + (Math.random() - 0.5) * 0.001;
        const baseStroke = -0.990625 + (Math.random() - 0.5) * 0.01;
        const baseTemp = 25.02746212121 + (Math.random() - 0.5) * 2;
        
        sampleRows.push(`88A29E218213,${timeStr},${baseX.toFixed(9)},${baseY.toFixed(10)},${baseZ.toFixed(10)},${baseStroke.toFixed(6)},${baseTemp.toFixed(11)}`);
      }
      
      csvContent = `Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C\n${sampleRows.join('\n')}`;
      fetchMethod = 'SampleData';
      actualFileName = 'sample-sensor-data.csv';
    }
    
    // Parse the CSV content
    console.log(`📊 Parsing CSV content (${csvContent.length} characters)...`);
    const parsedData = parseCSVToSensorData(csvContent);
    
    if (parsedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid sensor data found',
        debug: {
          csvPreview: csvContent.substring(0, 300),
          fetchMethod,
          contentLength: csvContent.length
        }
      }, { status: 400 });
    }
    
    // Sort by timestamp (newest first)
    parsedData.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get only the latest 1 minute of data
    const latestTimestamp = parsedData[0].timestamp;
    const oneMinuteAgo = latestTimestamp - (60 * 1000);
    const recentData = parsedData.filter(point => point.timestamp >= oneMinuteAgo);
    
    console.log(`✅ Parsed ${parsedData.length} total points, returning ${recentData.length} recent points`);
    console.log(`📈 Time range: ${new Date(oneMinuteAgo).toLocaleTimeString()} - ${new Date(latestTimestamp).toLocaleTimeString()}`);
    
    return NextResponse.json({
      success: true,
      data: recentData,
      metadata: {
        requestedFile: fileName || 'latest',
        actualFile: actualFileName,
        fetchMethod,
        totalDataPoints: parsedData.length,
        recentDataPoints: recentData.length,
        latestTimestamp: new Date(latestTimestamp).toLocaleString(),
        timeRange: `${new Date(oneMinuteAgo).toLocaleTimeString()} - ${new Date(latestTimestamp).toLocaleTimeString()}`,
        source: fetchMethod === 'SampleData' ? 'sample-data' : 'real-google-drive'
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sensor data',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}