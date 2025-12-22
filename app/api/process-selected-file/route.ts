import { NextRequest, NextResponse } from 'next/server';
import { parseCSVToSensorData, getRecentData } from '@/lib/csv-handler';

export async function POST(request: NextRequest) {
  try {
    const { fileName, csvContent } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({
        success: false,
        error: 'No file name provided'
      }, { status: 400 });
    }
    
    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No CSV content provided',
        message: `Please provide the content for file: ${fileName}`,
        instructions: [
          `1. Open Google Drive and find file: ${fileName}`,
          '2. Copy all content (Ctrl+A, Ctrl+C)',
          '3. Use the manual upload at /upload',
          '4. Or provide the content in this request'
        ]
      }, { status: 400 });
    }
    
    // Parse the CSV content
    const parsedData = parseCSVToSensorData(csvContent);
    
    if (parsedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid data found in CSV',
        message: 'The CSV content could not be parsed or contains no data'
      }, { status: 400 });
    }
    
    // Get the latest 1 minute of data
    const recentData = getRecentData(parsedData, 1);
    
    console.log(`📊 Processed file ${fileName}: ${parsedData.length} total points, ${recentData.length} recent points`);
    
    return NextResponse.json({
      success: true,
      fileName,
      data: recentData,
      count: recentData.length,
      totalCount: parsedData.length,
      timeRange: '1 minute(s)',
      lastUpdate: new Date().toISOString(),
      message: `Successfully processed ${fileName}: ${recentData.length} data points from the most recent 1 minute`,
      source: 'selected-file'
    });
    
  } catch (error) {
    console.error('Error processing selected file:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process selected file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}