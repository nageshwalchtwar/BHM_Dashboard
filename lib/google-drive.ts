/**
 * Google Drive API integration for CSV file access
 * 
 * To use this integration, you'll need to:
 * 1. Set up a Google Cloud Project
 * 2. Enable the Google Drive API
 * 3. Create service account credentials or OAuth2 credentials
 * 4. Add your credentials to environment variables
 */

interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
}

interface GoogleDriveConfig {
  folderId: string
  apiKey?: string
  accessToken?: string
}

export class GoogleDriveCSVReader {
  private config: GoogleDriveConfig

  constructor(config: GoogleDriveConfig) {
    this.config = config
  }

  /**
   * Try to access public files directly without API key (experimental)
   */
  async tryDirectPublicAccess(): Promise<string | null> {
    try {
      // For public folders, we can try to construct direct download URLs
      // This is a fallback method when API access is not available
      
      // Try a few common file patterns based on your folder structure
      const now = new Date()
      const timePatterns = [
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0')}`,
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours() - 1).padStart(2, '0')}-${String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0')}`,
      ]
      
      console.log('Trying direct public access for folder:', this.config.folderId)
      
      // This approach has limitations but can work for public files
      // For now, return null to force API usage
      return null
      
    } catch (error) {
      console.log('Direct public access failed:', error)
      return null
    }
  }

  /**
   * List all CSV files in the specified Google Drive folder
   */
  async listCSVFiles(): Promise<GoogleDriveFile[]> {
    if (!this.config.accessToken && !this.config.apiKey) {
      throw new Error('Access token or API key is required')
    }

    const query = `'${this.config.folderId}' in parents and (mimeType='text/csv' or name contains '.csv') and trashed=false`
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,size)`

    let finalUrl = url
    const headers: Record<string, string> = {}
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`
    } else if (this.config.apiKey) {
      finalUrl = `${url}&key=${this.config.apiKey}`
    }

    const response = await fetch(finalUrl, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`)
    }

    const data = await response.json()
    return data.files || []
  }

  /**
   * Get the latest (most recently modified) CSV file
   */
  async getLatestCSVFile(): Promise<GoogleDriveFile | null> {
    const files = await this.listCSVFiles()
    return files.length > 0 ? files[0] : null // Already sorted by modifiedTime desc
  }

  /**
   * Download and read the content of a specific file
   */
  async readFileContent(fileId: string): Promise<string> {
    if (!this.config.accessToken && !this.config.apiKey) {
      throw new Error('Access token or API key is required')
    }

    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    
    const headers: Record<string, string> = {}
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`
    } else if (this.config.apiKey) {
      url += `&key=${this.config.apiKey}`
    }

    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`)
    }

    return await response.text()
  }

  /**
   * Get the content of the latest CSV file
   */
  async getLatestCSVContent(): Promise<string | null> {
    const latestFile = await this.getLatestCSVFile()
    if (!latestFile) {
      return null
    }

    return await this.readFileContent(latestFile.id)
  }
}

/**
 * Environment-based configuration
 */
export function createGoogleDriveReader(): GoogleDriveCSVReader {
  const config: GoogleDriveConfig = {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    apiKey: process.env.GOOGLE_DRIVE_API_KEY,
    accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN
  }

  if (!config.folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is required')
  }

  return new GoogleDriveCSVReader(config)
}

/**
 * Extract folder ID from Google Drive URL
 * URL format: https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai?usp=sharing
 */
export function extractFolderIdFromUrl(url: string): string {
  const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Invalid Google Drive folder URL')
  }
  return match[1]
}

// Example usage:
const FOLDER_URL = "https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai?usp=sharing"
export const EXTRACTED_FOLDER_ID = extractFolderIdFromUrl(FOLDER_URL) // "17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai"