import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🎯 Generating test CSV data...');
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Generate realistic sensor data for the last minute
    const csvLines = ['Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C'];
    
    for (let i = 0; i < 12; i++) { // 12 points = one every 5 seconds for 1 minute
      const timestamp = new Date(oneMinuteAgo.getTime() + (i * 5000));
      const timestampStr = timestamp.toISOString().replace('T', ' ').replace('Z', '');
      
      csvLines.push([
        'TestDevice',
        timestampStr,
        (Math.sin(i * 0.5) + Math.random() * 0.2 - 0.1).toFixed(3), // X: sinusoidal with noise
        (Math.cos(i * 0.3) + Math.random() * 0.2 - 0.1).toFixed(3), // Y: cosine with noise  
        (1.0 + Math.random() * 0.1 - 0.05).toFixed(3), // Z: around 1g (gravity)
        (7.5 + Math.sin(i * 0.8) * 2 + Math.random() * 0.5).toFixed(2), // Stroke: 5.5-9.5 mm
        (22.5 + Math.sin(i * 0.2) + Math.random() * 0.5).toFixed(1)  // Temperature: 21.5-24°C
      ].join(','));
    }
    
    const csvContent = csvLines.join('\n');
    
    // Send this data to the upload endpoint
    const uploadResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/csv-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csvContent })
    });
    
    const uploadResult = await uploadResponse.json();
    
    return NextResponse.json({
      success: true,
      message: '🎯 Test data generated and uploaded successfully!',
      data: {
        csvPreview: csvLines.slice(0, 3).join('\n'),
        totalLines: csvLines.length - 1, // -1 for header
        uploadResult
      }
    });
    
  } catch (error) {
    console.error('Error generating test data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}