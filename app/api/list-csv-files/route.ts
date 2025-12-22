import { NextResponse } from 'next/server';

// Since we can't automatically list the files, let's provide the known recent files
// based on the pattern you showed me
export async function GET() {
  try {
    // Generate the latest 3 potential file names based on current time and your pattern
    const now = new Date();
    const files = [];
    
    // Your known recent files (you can update these manually when new files are created)
    const knownFiles = [
      { 
        name: '2025-12-20_20-50', 
        timestamp: '2025-12-20 20:50', 
        size: '271 KB',
        description: 'Latest file (Dec 20, 8:53 PM)'
      },
      { 
        name: '2025-12-20_20-40', 
        timestamp: '2025-12-20 20:40', 
        size: '765 KB',
        description: 'Dec 20, 8:49 PM'
      },
      { 
        name: '2025-12-20_20-30', 
        timestamp: '2025-12-20 20:30', 
        size: '743 KB',
        description: 'Dec 20, 8:39 PM'
      }
    ];
    
    // Generate potential current day files
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentHour = now.getHours().toString().padStart(2, '0');
    
    // Add potential current files
    const potentialTodayFiles = [
      `${today}_${currentHour}-50`,
      `${today}_${currentHour}-40`, 
      `${today}_${currentHour}-30`,
      `${today}_${currentHour}-20`,
      `${today}_${currentHour}-10`,
      `${today}_${currentHour}-00`
    ];
    
    potentialTodayFiles.forEach(filename => {
      files.push({
        name: filename,
        timestamp: filename.replace('_', ' ').replace('-', ':'),
        size: 'Unknown',
        description: 'Today - may exist'
      });
    });
    
    // Combine known files with potential today files, remove duplicates
    const allFiles = [...knownFiles];
    files.forEach(file => {
      if (!knownFiles.some(known => known.name === file.name)) {
        allFiles.push(file);
      }
    });
    
    // Sort by name (timestamp) descending to get latest first
    allFiles.sort((a, b) => b.name.localeCompare(a.name));
    
    return NextResponse.json({
      success: true,
      files: allFiles.slice(0, 6), // Return top 6 files
      message: 'Available CSV files for selection',
      note: 'Select a file to plot its latest 1-minute data'
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      files: []
    }, { status: 500 });
  }
}