// Alternative Google Drive access without API
export class DriveDirectAccess {
  private folderId: string;
  
  constructor(folderId: string) {
    this.folderId = folderId;
  }

  async getLatestCSV(): Promise<{ filename: string; content: string } | null> {
    try {
      // Try to access the folder via direct URL
      const folderUrl = `https://drive.google.com/drive/folders/${this.folderId}`;
      
      // Use a proxy service to bypass CORS
      const proxyUrl = `/api/drive-proxy?url=${encodeURIComponent(folderUrl)}`;
      
      const response = await fetch(proxyUrl);
      const html = await response.text();
      
      // Parse the HTML to find CSV files
      const csvFiles = this.extractCSVFiles(html);
      
      if (csvFiles.length === 0) {
        return null;
      }
      
      // Sort by date and get the latest
      const latestFile = csvFiles.sort((a, b) => 
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      )[0];
      
      // Get the file content
      const fileContent = await this.getFileContent(latestFile.id);
      
      return {
        filename: latestFile.name,
        content: fileContent
      };
      
    } catch (error) {
      console.error('Error accessing Drive folder:', error);
      return null;
    }
  }
  
  private extractCSVFiles(html: string): Array<{id: string, name: string, modified: string}> {
    const files: Array<{id: string, name: string, modified: string}> = [];
    
    // Look for CSV file patterns in the HTML
    const csvPattern = /data-id="([^"]+)"[^>]*>([^<]*\.csv)/gi;
    let match;
    
    while ((match = csvPattern.exec(html)) !== null) {
      const fileId = match[1];
      const fileName = match[2];
      
      // Extract modification date (this is approximate)
      const datePattern = new RegExp(`${fileName}.*?data-tooltip="([^"]+)"`, 'i');
      const dateMatch = html.match(datePattern);
      const modified = dateMatch ? dateMatch[1] : new Date().toISOString();
      
      files.push({
        id: fileId,
        name: fileName,
        modified: modified
      });
    }
    
    return files;
  }
  
  private async getFileContent(fileId: string): Promise<string> {
    try {
      // Direct download URL for Google Drive files
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const proxyUrl = `/api/drive-proxy?url=${encodeURIComponent(downloadUrl)}`;
      
      const response = await fetch(proxyUrl);
      return await response.text();
      
    } catch (error) {
      console.error('Error downloading file:', error);
      return '';
    }
  }
}