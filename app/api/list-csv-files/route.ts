import { NextResponse } from 'next/server';

// Since we can't automatically list the files, let's provide the known recent files
// based on the pattern you showed me
export async function GET() {
  try {
    // Generate the latest 3 potential file names based on current time and your pattern
    const now = new Date();
    const files = [];
    
    // Your known recent files (based on what you showed me)
    const knownFiles = [
      { 
        name: '2025-12-22_08-00', 
        timestamp: '2025-12-22 08:00', 
        size: 'Current',
        description: 'Today 8:00 AM (if exists)'
      },
      { 
        name: '2025-12-22_07-50', 
        timestamp: '2025-12-22 07:50', 
        size: 'Current',
        description: 'Today 7:50 AM (if exists)'
      },
      { 
        name: '2025-12-22_07-40', 
        timestamp: '2025-12-22 07:40', 
        size: 'Current',
        description: 'Today 7:40 AM (if exists)'
      },
      { 
        name: '2025-12-20_20-50', 
        timestamp: '2025-12-20 20:50', 
        size: '271 KB',
        description: 'Latest confirmed file (Dec 20, 8:53 PM)'
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
    
    // Generate potential current day files (last 2 hours, every 10 minutes)
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentHour = now.getHours();
    const potentialTodayFiles = [];
    
    for (let h = Math.max(0, currentHour - 1); h <= currentHour; h++) {
      for (let m = 0; m < 60; m += 10) {
        const hourStr = h.toString().padStart(2, '0');
        const minStr = m.toString().padStart(2, '0');
        const filename = `${today}_${hourStr}-${minStr}`;
        
        // Only add if not already in known files
        if (!knownFiles.some(known => known.name === filename)) {
          potentialTodayFiles.push({
            name: filename,
            timestamp: `${today} ${hourStr}:${minStr}`,
            size: 'Unknown',
            description: `Today ${h}:${minStr.padStart(2, '0')} (may exist)`
          });
        }
      }
    }
    
    // Combine and sort
    const allFiles = [...knownFiles, ...potentialTodayFiles.slice(0, 3)];
    allFiles.sort((a, b) => b.name.localeCompare(a.name));
    
    return NextResponse.json({
      success: true,
      files: allFiles.slice(0, 6), // Return top 6 files
      message: 'Available CSV files for selection',
      note: 'Select a file, copy its content from Google Drive, and plot the data'
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      files: []
    }, { status: 500 });
  }
}