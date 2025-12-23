// Direct access to your shared Google Drive folder
// Since you've provided access to sagarkatakwar.22@stvincentngp.edu.in

const FOLDER_ID = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';

// Try to access the actual Google Drive files using the public API
export async function accessSharedGoogleDriveFolder(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔗 Accessing your shared Google Drive folder...');
    console.log('📂 Folder ID:', FOLDER_ID);
    
    // Method 1: Try Google Drive API v3 without auth (for public folders)
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`;
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.files && data.files.length > 0) {
          // Get the latest file
          const latestFile = data.files[0];
          console.log(`📄 Latest file found: ${latestFile.name}`);
          
          // Try to download the file content
          const fileContent = await downloadFileFromDrive(latestFile.id);
          if (fileContent) {
            return {
              filename: latestFile.name,
              content: fileContent
            };
          }
        }
      }
    } catch (apiError) {
      console.log('API method failed:', apiError);
    }
    
    // Method 2: Try direct file ID access with known recent patterns
    const recentPatterns = generateCurrentTimePatterns();
    
    for (const pattern of recentPatterns) {
      try {
        console.log(`🔍 Trying to access file: ${pattern}`);
        
        // Try different Google Drive URL formats
        const urls = [
          `https://docs.google.com/spreadsheets/d/${pattern}/export?format=csv`,
          `https://drive.google.com/uc?id=${pattern}&export=download`,
          `https://www.googleapis.com/drive/v3/files/${pattern}?alt=media`,
        ];
        
        for (const url of urls) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'User-Agent': 'BHM-Dashboard/1.0',
                'Accept': 'text/csv,application/csv,text/plain,*/*',
              }
            });
            
            if (response.ok) {
              const content = await response.text();
              
              // Check if it's valid CSV with your format
              if (content && content.length > 100 && 
                  (content.includes('Device,Timestamp') || content.includes('88A29E218213'))) {
                
                console.log(`✅ Successfully got file content (${content.length} chars)`);
                return {
                  filename: `${pattern}.csv`,
                  content: content
                };
              }
            }
          } catch (err) {
            console.log(`URL failed: ${url}`);
          }
        }
      } catch (err) {
        console.log(`Pattern failed: ${pattern}`);
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error accessing shared folder:', error);
    return null;
  }
}

// Generate patterns based on current time (last few hours)
function generateCurrentTimePatterns(): string[] {
  const now = new Date();
  const patterns: string[] = [];
  
  // Generate patterns for the last 6 hours with 10-minute intervals
  for (let hoursBack = 0; hoursBack < 6; hoursBack++) {
    for (let minutesBack = 0; minutesBack < 60; minutesBack += 10) {
      const targetTime = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000) - (minutesBack * 60 * 1000));
      const year = targetTime.getFullYear();
      const month = String(targetTime.getMonth() + 1).padStart(2, '0');
      const day = String(targetTime.getDate()).padStart(2, '0');
      const hour = String(targetTime.getHours()).padStart(2, '0');
      const minute = String(targetTime.getMinutes()).padStart(2, '0');
      
      // Round minutes to nearest 10
      const roundedMinute = String(Math.floor(targetTime.getMinutes() / 10) * 10).padStart(2, '0');
      
      patterns.push(`${year}-${month}-${day}_${hour}-${roundedMinute}`);
    }
  }
  
  // Remove duplicates and sort by most recent first
  return [...new Set(patterns)];
}

// Try to download file content using file ID
async function downloadFileFromDrive(fileId: string): Promise<string | null> {
  try {
    const urls = [
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      `https://drive.google.com/uc?id=${fileId}&export=download`,
      `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
    ];
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          if (content && content.length > 50) {
            console.log(`✅ Downloaded content from ${url} (${content.length} chars)`);
            return content;
          }
        }
      } catch (err) {
        console.log(`Download URL failed: ${url}`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Download error:', error);
    return null;
  }
}

// Alternative approach using Google Apps Script Web App (if you set one up)
export async function tryWebAppAccess(): Promise<string | null> {
  try {
    // You could deploy a Google Apps Script that reads your folder
    // and publishes the latest CSV content via a web app URL
    const webAppUrl = `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?folder=${FOLDER_ID}`;
    
    const response = await fetch(webAppUrl);
    if (response.ok) {
      const content = await response.text();
      if (content && content.length > 100) {
        return content;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}