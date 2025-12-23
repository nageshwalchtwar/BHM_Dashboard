// Real Google Drive CSV file accessor using direct file access
export class RealGoogleDriveReader {
  private folderId: string;
  
  constructor(folderId: string) {
    this.folderId = folderId;
  }

  async getLatestRealCSV(): Promise<{ filename: string; content: string } | null> {
    console.log('🎯 Accessing real CSV files from Google Drive...');
    
    try {
      // Method 1: Try to get the file list and access the latest file
      const fileList = await this.getRealFileList();
      
      if (fileList.length > 0) {
        // Sort by filename (timestamp) to get the latest
        const latestFile = fileList.sort((a, b) => b.filename.localeCompare(a.filename))[0];
        console.log(`📄 Found latest file: ${latestFile.filename}`);
        
        const content = await this.downloadRealFile(latestFile.fileId);
        if (content) {
          return { filename: latestFile.filename, content };
        }
      }
      
      // Method 2: Try known recent file patterns
      const recentPatterns = this.generateRecentFilePatterns();
      
      for (const pattern of recentPatterns) {
        try {
          console.log(`🔍 Trying pattern: ${pattern.filename}`);
          const content = await this.tryDirectFileAccess(pattern.filename);
          if (content) {
            return { filename: pattern.filename, content };
          }
        } catch (error) {
          console.log(`❌ Pattern ${pattern.filename} failed`);
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('🚫 Error accessing real CSV files:', error);
      return null;
    }
  }
  
  private async getRealFileList(): Promise<Array<{filename: string, fileId: string}>> {
    try {
      // Use Google Drive API directly instead of drive-proxy to avoid URL parsing issues
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google Drive API key not configured');
      }
      
      console.log('🔑 Using direct Google Drive API for file listing...');
      
      // List files in the folder using Google Drive API
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${this.folderId}'+in+parents&orderBy=modifiedTime desc&key=${apiKey}&fields=files(id,name,modifiedTime)`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Google Drive API failed: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      const files: Array<{filename: string, fileId: string}> = [];
      
      // Filter for CSV files that match the expected pattern
      if (data.files) {
        for (const file of data.files) {
          if (file.name && file.name.includes('2025-12') && (file.name.endsWith('.csv') || file.name.includes('csv'))) {
            files.push({
              filename: file.name,
              fileId: file.id
            });
            console.log(`✅ Found CSV file: ${file.name} (ID: ${file.id})`);
          }
        }
      }
      
      return files;
      
    } catch (error) {
      console.error('Error getting file list:', error);
      return [];
    }
  }
  
  private async downloadRealFile(fileId: string): Promise<string | null> {
    try {
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      if (!apiKey) {
        console.error('Google Drive API key not configured');
        return null;
      }
      
      // Try Google Sheets export first
      try {
        const sheetsUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=0`;
        const response = await fetch(sheetsUrl);
        
        if (response.ok) {
          const content = await response.text();
          if (content.length > 100 && content.includes('Device')) {
            console.log(`✅ Successfully downloaded via Sheets export (${content.length} chars)`);
            return content;
          }
        }
      } catch (sheetsError) {
        console.log('⚠️ Sheets export failed, trying direct download...');
      }
      
      // Fallback to direct file download
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const response = await fetch(downloadUrl);
      
      if (response.ok) {
        const content = await response.text();
        if (content.length > 100 && content.includes('Device')) {
          console.log(`✅ Successfully downloaded file (${content.length} chars)`);
          return content;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Download failed:', error);
      return null;
    }
  }
  
  private generateRecentFilePatterns(): Array<{filename: string}> {
    const now = new Date();
    const patterns: Array<{filename: string}> = [];
    
    // Generate patterns for the last 2 hours, every 10 minutes
    for (let i = 0; i < 12; i++) {
      const time = new Date(now.getTime() - (i * 10 * 60 * 1000));
      const year = time.getFullYear();
      const month = String(time.getMonth() + 1).padStart(2, '0');
      const day = String(time.getDate()).padStart(2, '0');
      const hour = String(time.getHours()).padStart(2, '0');
      const minute = String(Math.floor(time.getMinutes() / 10) * 10).padStart(2, '0');
      
      const filename = `${year}-${month}-${day}_${hour}-${minute}`;
      patterns.push({ filename });
    }
    
    return patterns;
  }
  
  private async tryDirectFileAccess(filename: string): Promise<string | null> {
    // This would require knowing the exact file ID, which is complex
    // For now, return null and rely on the file list method
    return null;
  }
}