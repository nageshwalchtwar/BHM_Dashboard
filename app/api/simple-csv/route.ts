import { NextResponse } from 'next/server';

// Simple CSV fetcher - no complex authentication, just direct access
export async function GET() {
  const folderId = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
  
  console.log('📄 Fetching CSV data from Google Drive...');

  try {
    // Try simple direct access methods
    const methods = [
      // Method 1: Direct folder as spreadsheet
      `https://docs.google.com/spreadsheets/d/${folderId}/export?format=csv&gid=0`,
      // Method 2: Drive download
      `https://drive.google.com/uc?id=${folderId}&export=download`,
      // Method 3: Alternative export
      `https://docs.google.com/spreadsheets/d/${folderId}/gviz/tq?tqx=out:csv`
    ];

    for (const url of methods) {
      try {
        console.log(`🔍 Trying: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Dashboard/1.0)'
          }
        });

        if (response.ok) {
          const csvContent = await response.text();
          
          // Check if it looks like CSV with our expected format
          if (csvContent && csvContent.length > 50 && csvContent.includes(',')) {
            console.log(`✅ Found CSV content: ${csvContent.length} characters`);
            
            // Parse CSV to JSON
            const lines = csvContent.trim().split('\n');
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',');
              if (values.length >= headers.length) {
                const row: any = {};
                headers.forEach((header, index) => {
                  row[header.trim()] = values[index]?.trim() || '';
                });
                
                // Convert to the format expected by charts
                if (row.Timestamp && (row.X || row.Y || row.Z)) {
                  data.push({
                    timestamp: new Date(row.Timestamp).getTime(),
                    vibration: {
                      x: parseFloat(row.X) || 0,
                      y: parseFloat(row.Y) || 0,
                      z: parseFloat(row.Z) || 0
                    },
                    acceleration: {
                      x: parseFloat(row.X) || 0,
                      y: parseFloat(row.Y) || 0,
                      z: parseFloat(row.Z) || 0
                    },
                    strain: parseFloat(row.Stroke_mm) || 0,
                    temperature: parseFloat(row.Temperature_C) || 0
                  });
                }
              }
            }

            console.log(`📊 Parsed ${data.length} data points`);
            
            return NextResponse.json({
              success: true,
              data: data.slice(-100), // Last 100 points
              metadata: {
                totalPoints: data.length,
                source: 'Google Drive CSV',
                lastUpdate: new Date().toISOString(),
                filename: 'latest.csv'
              }
            });
          }
        }
      } catch (methodError) {
        console.log(`❌ Method failed: ${methodError}`);
        continue;
      }
    }

    // If no method worked, return empty data
    console.log('❌ No CSV data found');
    return NextResponse.json({
      success: false,
      data: [],
      error: 'No CSV data accessible',
      metadata: {
        totalPoints: 0,
        source: 'None',
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ CSV fetch error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        totalPoints: 0,
        source: 'Error',
        lastUpdate: new Date().toISOString()
      }
    });
  }
}