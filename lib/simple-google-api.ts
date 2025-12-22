// Simplified Google Drive API access using direct API calls
// This provides multiple authentication methods including service accounts

export class SimpleGoogleDriveAPI {
  constructor(
    private folderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID || '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai',
    private apiKey?: string
  ) {}

  // Method 1: Try with API Key (if folder is publicly shared)
  async listFilesWithAPIKey(): Promise<Array<{id: string, name: string, modifiedTime: string}> | null> {
    if (!this.apiKey) {
      console.log('❌ No API key provided');
      return null;
    }

    try {
      console.log('🔑 Trying Google Drive API with API key...');
      
      const url = `https://www.googleapis.com/drive/v3/files?q='${this.folderId}'+in+parents&orderBy=modifiedTime desc&key=${this.apiKey}&fields=files(id,name,modifiedTime,size)`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`❌ API key request failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.files?.length || 0} files via API key`);
      
      return data.files || [];
      
    } catch (error) {
      console.log('❌ API key method error:', error);
      return null;
    }
  }

  // Method 2: Download file content with API Key
  async downloadFileWithAPIKey(fileId: string): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`
      );
      
      if (response.ok) {
        return await response.text();
      }
      
      return null;
      
    } catch (error) {
      console.log('❌ Download error:', error);
      return null;
    }
  }

  // Method 3: Try accessing as public/shared folder
  async getPublicFolderContent(): Promise<string | null> {
    try {
      console.log('🌐 Trying public folder access patterns...');
      
      // Different URL patterns to try for public access
      const urls = [
        `https://drive.google.com/drive/folders/${this.folderId}`,
        `https://docs.google.com/spreadsheets/d/${this.folderId}/export?format=csv`,
        `https://drive.google.com/uc?id=${this.folderId}&export=download`,
        `https://drive.google.com/file/d/${this.folderId}/view`,
      ];

      for (const url of urls) {
        try {
          console.log(`🔍 Trying: ${url.substring(0, 60)}...`);
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)',
              'Accept': 'text/csv,application/csv,text/plain,*/*'
            }
          });
          
          if (response.ok) {
            const content = await response.text();
            
            // Check if this looks like CSV content
            if (content.includes('Device,Timestamp') || content.includes('CSV')) {
              console.log(`✅ Found CSV content (${content.length} chars)`);
              return content;
            }
          }
          
        } catch (error) {
          // Continue to next URL
        }
      }
      
      return null;
      
    } catch (error) {
      console.log('❌ Public access error:', error);
      return null;
    }
  }

  // Get latest CSV file using all available methods
  async getLatestCSV(): Promise<{filename: string, content: string} | null> {
    try {
      console.log('🎯 Getting latest CSV using Simple Google Drive API...');
      
      // Method 1: Try API key first
      if (this.apiKey) {
        const files = await this.listFilesWithAPIKey();
        
        if (files && files.length > 0) {
          const latestFile = files[0]; // Already sorted by modifiedTime desc
          console.log(`📄 Latest file via API key: ${latestFile.name}`);
          
          const content = await this.downloadFileWithAPIKey(latestFile.id);
          
          if (content && content.includes('Device,Timestamp')) {
            return {
              filename: latestFile.name,
              content: content
            };
          }
        }
      }
      
      // Method 2: Try public access patterns
      const publicContent = await this.getPublicFolderContent();
      
      if (publicContent && publicContent.includes('Device,Timestamp')) {
        return {
          filename: 'latest-from-public-access.csv',
          content: publicContent
        };
      }
      
      console.log('❌ No CSV content found via Simple API');
      return null;
      
    } catch (error) {
      console.log('❌ Simple Google Drive API error:', error);
      return null;
    }
  }
}

// Quick helper function to try getting CSV content using any available method
export async function getCSVFromGoogleDrive(): Promise<{filename: string, content: string} | null> {
  try {
    // Try different API configurations
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
    
    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    return await api.getLatestCSV();
    
  } catch (error) {
    console.log('❌ getCSVFromGoogleDrive error:', error);
    return null;
  }
}

export default SimpleGoogleDriveAPI;