// Direct access to your shared Google Drive folder
// Since you've provided access to sagarkatakwar.22@stvincentngp.edu.in

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

// Direct file patterns based on your naming convention
function generateFilePatterns(): string[] {
  const now = new Date();
  const patterns: string[] = [];
  
  // Generate patterns for the last 24 hours
  for (let hoursBack = 0; hoursBack < 24; hoursBack++) {
    const targetTime = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
    const year = targetTime.getFullYear();
    const month = String(targetTime.getMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getDate()).padStart(2, '0');
    const hour = String(targetTime.getHours()).padStart(2, '0');
    
    // Try different minute patterns (00, 10, 20, 30, 40, 50)
    for (let minute = 50; minute >= 0; minute -= 10) {
      const min = String(minute).padStart(2, '0');
      patterns.push(`${year}-${month}-${day}_${hour}-${min}`);
    }
  }
  
  return patterns;
}

// Try accessing files directly from the shared folder
export async function accessSharedGoogleDriveFolder(): Promise<{filename: string, content: string} | null> {
  try {
    console.log('🔗 Accessing your shared Google Drive folder...');
    console.log('📂 Folder ID:', FOLDER_ID);
    
    // Method 1: Try Google Drive export URLs (for shared folders)
    const exportUrls = [
      `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`,
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&fields=files(id,name,modifiedTime)`,
      `https://drive.google.com/uc?export=download&id=${FOLDER_ID}`,
    ];
    
    // Method 2: Try direct file access with known patterns
    const patterns = generateFilePatterns();
    
    for (const pattern of patterns.slice(0, 10)) { // Try first 10 patterns
      try {
        console.log(`🔍 Trying pattern: ${pattern}`);
        
        // Try different file URL formats
        const fileUrls = [
          `https://drive.google.com/uc?export=download&id=${FOLDER_ID}/${pattern}.csv`,
          `https://docs.google.com/spreadsheets/d/${FOLDER_ID}/export?format=csv&gid=0&range=${pattern}`,
        ];
        
        for (const url of fileUrls) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'User-Agent': 'BHM-Dashboard/1.0',
                'Accept': 'text/csv,text/plain,*/*',
              }
            });
            
            if (response.ok) {
              const content = await response.text();
              
              // Check if it looks like valid CSV data
              if (content && content.length > 100 && 
                  (content.includes('Device') || content.includes('Timestamp') || 
                   content.includes('88A29E218213'))) {
                
                console.log(`✅ Successfully accessed file: ${pattern}`);
                return {
                  filename: `${pattern}.csv`,
                  content: content
                };
              }
            }
          } catch (err) {
            // Continue to next URL
          }
        }
      } catch (err) {
        // Continue to next pattern
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error accessing shared folder:', error);
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