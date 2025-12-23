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
      // Access the folder HTML to extract real file information
      const folderUrl = `https://drive.google.com/drive/folders/${this.folderId}`;
      
      // Use proper URL encoding to avoid parsing errors
      const encodedUrl = encodeURIComponent(folderUrl);
      const proxyUrl = `/api/drive-proxy?url=${encodedUrl}`;
      
      console.log('🔗 Accessing folder via proxy:', proxyUrl);
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Folder access failed: ${response.status} - ${response.statusText}`);
      }
      
      const html = await response.text();
      const files: Array<{filename: string, fileId: string}> = [];
      
      // Look for the specific file pattern in the HTML
      // Google Drive stores file info in data attributes
      const fileRegex = /data-id="([^"]+)"[^>]*>[^<]*?(2025-12-20_\d{2}-\d{2})[^<]*/g;
      let match;
      
      while ((match = fileRegex.exec(html)) !== null) {
        const fileId = match[1];
        const filename = match[2];
        
        if (filename && fileId) {
          files.push({ filename, fileId });
          console.log(`✅ Found real file: ${filename} (ID: ${fileId})`);
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
      // Direct download URL for Google Drive files
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(`/api/drive-proxy?url=${encodeURIComponent(downloadUrl)}`);
      
      if (response.ok) {
        const content = await response.text();
        if (content.length > 100 && content.includes('Device,Timestamp')) {
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