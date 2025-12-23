// Secure Google Drive API implementation for accessing shared folder
const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';

export class SecureGoogleDriveReader {
  private folderId: string;
  
  constructor(folderId: string = FOLDER_ID) {
    this.folderId = folderId;
  }

  async listFilesFromFolder(): Promise<Array<{id: string, name: string, modifiedTime: string}>> {
    try {
      console.log('📂 Accessing Google Drive folder via API...');
      
      // Use Google Drive API v3 to list files in the folder
      const url = `https://www.googleapis.com/drive/v3/files?q='${this.folderId}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.files?.length || 0} files in folder`);
      
      return data.files || [];
    } catch (error) {
      console.error('❌ Error listing files:', error);
      return [];
    }
  }

  async downloadFileContent(fileId: string): Promise<string> {
    try {
      console.log(`📥 Downloading file content: ${fileId}`);
      
      // Download file content using Google Drive API
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`File download error: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      console.log(`✅ Downloaded ${content.length} characters`);
      
      return content;
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      throw error;
    }
  }

  async getLatestCSVFile(): Promise<{filename: string, content: string} | null> {
    try {
      const files = await this.listFilesFromFolder();
      
      // Filter for CSV files and get the latest one
      const csvFiles = files.filter(file => 
        file.name.toLowerCase().includes('.csv') || 
        file.name.toLowerCase().includes('2025-') ||
        /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}/.test(file.name)
      );
      
      if (csvFiles.length === 0) {
        console.log('❌ No CSV files found');
        return null;
      }
      
      // Sort by modified time and get the latest
      csvFiles.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
      const latestFile = csvFiles[0];
      
      console.log(`📄 Latest file: ${latestFile.name} (modified: ${latestFile.modifiedTime})`);
      
      const content = await this.downloadFileContent(latestFile.id);
      
      return {
        filename: latestFile.name,
        content: content
      };
      
    } catch (error) {
      console.error('❌ Error getting latest CSV:', error);
      return null;
    }
  }
}

// Public folder access method (fallback)
export async function getLatestCSVFromPublicFolder(): Promise<string | null> {
  try {
    console.log('🌐 Trying public folder access...');
    
    // Try accessing as a public shared folder
    const folderUrl = `https://drive.google.com/drive/folders/${FOLDER_ID}`;
    
    // Try different public access methods
    const publicUrls = [
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`,
      `https://drive.google.com/uc?export=download&id=${FOLDER_ID}`,
    ];
    
    for (const url of publicUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          if (content && content.length > 100) {
            console.log(`✅ Got content via public access (${content.length} chars)`);
            return content;
          }
        }
      } catch (err) {
        console.log(`Public URL failed: ${url}`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Public folder access failed:', error);
    return null;
  }
}