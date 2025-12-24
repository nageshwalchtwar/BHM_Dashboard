// Authenticated Google Drive API client using your credentials
// This will use proper OAuth2 authentication to access your private Google Drive folder

class GoogleDriveAuthenticatedClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor(
    private clientId: string = process.env.GOOGLE_CLIENT_ID || '',
    private clientSecret: string = process.env.GOOGLE_CLIENT_SECRET || '',
    private refreshToken: string = process.env.GOOGLE_REFRESH_TOKEN || '',
    private folderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM'
  ) {}

  // Get access token using refresh token
  private async getAccessToken(): Promise<string> {
    try {
      // Check if current token is still valid
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      console.log('🔑 Refreshing Google Drive access token...');

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early
      
      console.log('✅ Access token refreshed successfully');
      
      if (!this.accessToken) {
        throw new Error('No access token received from OAuth response');
      }
      
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  }

  // List files in your Google Drive folder (sorted by modified time)
  async listFiles(): Promise<Array<{id: string, name: string, modifiedTime: string, size: string}>> {
    try {
      const token = await this.getAccessToken();
      
      console.log(`📂 Listing files in folder: ${this.folderId}`);
      
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.append('q', `'${this.folderId}' in parents and trashed=false`);
      url.searchParams.append('orderBy', 'modifiedTime desc');
      url.searchParams.append('fields', 'files(id,name,modifiedTime,size,mimeType)');
      url.searchParams.append('pageSize', '50');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const files = data.files || [];
      
      console.log(`📋 Found ${files.length} files in your Google Drive folder`);
      
      // Filter for CSV files or files with your naming pattern
      const csvFiles = files.filter((file: any) => 
        file.name.toLowerCase().includes('.csv') ||
        file.name.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}/) ||
        file.mimeType === 'text/csv'
      );
      
      console.log(`📄 Found ${csvFiles.length} CSV files`);
      
      return csvFiles;

    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }

  // Download file content by file ID
  async downloadFile(fileId: string): Promise<string> {
    try {
      const token = await this.getAccessToken();
      
      console.log(`⬇️ Downloading file: ${fileId}`);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      console.log(`✅ Downloaded ${content.length} characters`);
      
      return content;

    } catch (error) {
      console.error('❌ Error downloading file:', error);
      throw error;
    }
  }

  // Get the latest CSV file from your folder
  async getLatestCSVFile(): Promise<{filename: string, content: string} | null> {
    try {
      console.log('🎯 Getting latest CSV file from your authenticated Google Drive...');
      
      const files = await this.listFiles();
      
      if (files.length === 0) {
        console.log('❌ No files found in the folder');
        return null;
      }

      // Get the most recently modified file
      const latestFile = files[0]; // Already sorted by modifiedTime desc
      
      console.log(`📄 Latest file: ${latestFile.name} (modified: ${latestFile.modifiedTime})`);
      
      const content = await this.downloadFile(latestFile.id);
      
      // Validate it's a CSV file with flexible header matching
      // Check for common CSV header patterns and sensor identifiers
      const hasValidFormat = 
        content.includes('Device,Timestamp') || 
        content.includes('88A29E218213') ||
        content.includes('Timestamp') && content.match(/\d+:\d+:\d+/) || // Any timestamp format with time
        (content.includes('X,Y,Z') || content.includes('accel')) && content.length > 100; // Sensor data pattern
      
      if (hasValidFormat) {
        console.log(`✅ Valid CSV file found with sensor data format`);
        return {
          filename: latestFile.name,
          content: content
        };
      } else {
        console.log(`⚠️ File found but doesn't match expected CSV format`);
        console.log('📊 Content preview (first 200 chars):', content.substring(0, 200));
        console.log('📊 File size:', content.length, 'bytes');
        // Still return the file even if format doesn't match expected pattern
        // The parser can handle various formats
        console.log('ℹ️ Returning file anyway - parser may handle it');
        return {
          filename: latestFile.name,
          content: content
        };
      }

    } catch (error) {
      console.error('❌ Error getting latest CSV file:', error);
      if (error instanceof Error) {
        console.error('💥 Error details:', error.message);
        console.error('🔍 Stack:', error.stack?.substring(0, 500));
      }
      return null;
    }
  }
}

// Export the authenticated client
export { GoogleDriveAuthenticatedClient };

// Alternative: Simple API key approach (for public access)
export async function getLatestCSVWithAPIKey(): Promise<{filename: string, content: string} | null> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    
    if (!apiKey) {
      console.log('❌ No API key configured');
      return null;
    }

    console.log('🔑 Using Google Drive API key method...');
    
    // List files using API key
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&orderBy=modifiedTime desc&key=${apiKey}&fields=files(id,name,modifiedTime)`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const files = data.files || [];
    
    if (files.length === 0) {
      console.log('❌ No files found');
      return null;
    }
    
    const latestFile = files[0];
    
    // Download the file content
    const contentResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media&key=${apiKey}`
    );
    
    if (contentResponse.ok) {
      const content = await contentResponse.text();
      return {
        filename: latestFile.name,
        content: content
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ API key method failed:', error);
    return null;
  }
}