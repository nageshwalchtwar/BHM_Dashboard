// Simplified Google Drive API access using direct API calls
// This provides multiple authentication methods including service accounts
import { extractFolderIdFromUrl } from './device-config';

// ── In-memory file content cache ──────────────────────────────────────────
// Key = fileId, Value = { content, modifiedTime, cachedAt }
interface FileCacheEntry {
  content: string;
  modifiedTime: string;
  cachedAt: number;
}
const fileCache = new Map<string, FileCacheEntry>();
const FILE_CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes — files don't change once written
const FILE_CACHE_MAX_SIZE = 300;

function getCachedFile(fileId: string, modifiedTime: string): string | null {
  const entry = fileCache.get(fileId);
  if (entry && entry.modifiedTime === modifiedTime && (Date.now() - entry.cachedAt) < FILE_CACHE_MAX_AGE) {
    return entry.content;
  }
  return null;
}

function setCachedFile(fileId: string, modifiedTime: string, content: string) {
  // Evict oldest entries if cache is too large
  if (fileCache.size >= FILE_CACHE_MAX_SIZE) {
    const oldest = [...fileCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    for (let i = 0; i < 50 && i < oldest.length; i++) {
      fileCache.delete(oldest[i][0]);
    }
  }
  fileCache.set(fileId, { content, modifiedTime, cachedAt: Date.now() });
}

export class SimpleGoogleDriveAPI {
  constructor(
    private folderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM',
    private apiKey?: string
  ) {}

  // Helper to perform fetch with timeout, returns null on failure
  private async fetchWithTimeout(url: string, opts: any = {}, timeoutMs = 8000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal })
      return res
    } catch (err) {
      console.log(`❌ fetch failed for ${url}:`, err instanceof Error ? err.message : String(err))
      return null
    } finally {
      clearTimeout(id)
    }
  }

  // Method 1: Try with API Key (if folder is publicly shared)
  async listFilesWithAPIKey(sinceDate?: string): Promise<Array<{id: string, name: string, modifiedTime: string}> | null> {
    if (!this.apiKey) {
      console.log('❌ No API key provided');
      return null;
    }

    try {
      console.log('🔑 Trying Google Drive API with API key...');
      console.log(`📂 Folder ID: ${this.folderId}`);
      
      // Build query with optional date filter
      let query = `'${this.folderId}' in parents`;
      if (sinceDate) {
        query += ` and modifiedTime > '${sinceDate}'`;
      }
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&orderBy=modifiedTime desc&pageSize=200&key=${this.apiKey}&fields=files(id,name,modifiedTime,size,mimeType)`;
      
      const response = await this.fetchWithTimeout(url)
      
      if (!response || !response.ok) {
        console.log(`❌ API key request failed or timed out`);
        const errorText = response ? await response.text() : 'timeout or fetch error'
        console.log(`📄 Error response: ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.files?.length || 0} files via API key${sinceDate ? ` (since ${sinceDate})` : ''}`);
      
      // Log file types for debugging
      if (data.files && data.files.length > 0) {
        console.log(`📊 Latest file: ${data.files[0].name} (Type: ${data.files[0].mimeType || 'unknown'})`);
      }
      
      return data.files || [];
      
    } catch (error) {
      console.log('❌ API key method error:', error);
      return null;
    }
  }

  // Method 2: Download file content with API Key (Google Sheets as CSV export)
  async downloadFileWithAPIKey(fileId: string, retries = 2): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 2s, 4s
          const delay = 2000 * attempt;
          console.log(`⏳ Retry ${attempt}/${retries} for ${fileId} after ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }

        // First try Google Sheets export (most common case)
        const exportResponse = await this.fetchWithTimeout(
          `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)',
              'Accept': 'text/csv,application/csv,text/plain,*/*'
            }
          }
        );
        
        if (exportResponse && exportResponse.ok) {
          const content = await exportResponse.text();
          
          if (content && content.length > 100 && content.includes('Device')) {
            return content;
          }
        } else if (exportResponse && exportResponse.status === 429) {
          // Rate limited — retry
          console.log(`⚠️ Rate limited on export for ${fileId}`);
          continue;
        }
        
        // Fallback to regular file download for actual CSV files
        const response = await this.fetchWithTimeout(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`
        );
        
        if (response && response.ok) {
          const content = await response.text();
          if (content && content.includes('Device')) {
            return content;
          }
        } else if (response && response.status === 429) {
          console.log(`⚠️ Rate limited on Drive API for ${fileId}`);
          continue;
        }
        
        return null;
        
      } catch (error) {
        if (attempt === retries) {
          console.log('❌ Download error:', error);
          return null;
        }
      }
    }
    return null;
  }

  // Fast single-attempt download for batch use — no retries, 5s timeout, Sheets export only
  async downloadFileQuick(fileId: string): Promise<string | null> {
    try {
      const exportResponse = await this.fetchWithTimeout(
        `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)',
            'Accept': 'text/csv,application/csv,text/plain,*/*'
          }
        },
        5000 // 5 second timeout
      );

      if (exportResponse && exportResponse.ok) {
        const content = await exportResponse.text();
        if (content && content.length > 100 && content.includes('Device')) {
          return content;
        }
      }

      // Quick fallback to Drive API (only if export failed completely)
      const response = await this.fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`,
        {},
        5000
      );
      if (response && response.ok) {
        const content = await response.text();
        if (content && content.includes('Device')) {
          return content;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // Method 3: Try accessing as public/shared folder
  async getPublicFolderContent(): Promise<string | null> {
    try {
      console.log('🌐 Trying public folder access patterns...');
      
      // Different URL patterns to try for public access (prioritize Google Sheets export)
      const urls = [
        `https://docs.google.com/spreadsheets/d/${this.folderId}/export?format=csv`,
        `https://drive.google.com/uc?id=${this.folderId}&export=download`,
        `https://drive.google.com/drive/folders/${this.folderId}`,
        `https://drive.google.com/file/d/${this.folderId}/view`,
      ];

      for (const url of urls) {
        try {
          console.log(`🔍 Trying: ${url.substring(0, 60)}...`);
          
          const response = await this.fetchWithTimeout(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)',
              'Accept': 'text/csv,application/csv,text/plain,*/*'
            }
          });
          
          if (response && response.ok) {
            const content = await response.text();
            
            // Check if this looks like CSV content
            if (content.includes('Device,Timestamp') || content.includes('CSV')) {
              console.log(`✅ Found CSV content (${content.length} chars)`);
              return content;
            }
          } else {
            console.log(`❌ Public URL failed or timed out: ${url}`)
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
  async getLatestCSV(): Promise<{filename: string, content: string, modifiedTime?: string} | null> {
    try {
      console.log('🎯 Getting latest CSV using Simple Google Drive API...');
      
      // Method 1: Try API key first
      if (this.apiKey) {
        const files = await this.listFilesWithAPIKey();
        
        if (files && files.length > 0) {
          const latestFile = files[0]; // Already sorted by modifiedTime desc
          console.log(`📄 Latest file via API key: ${latestFile.name} (modified: ${latestFile.modifiedTime})`);
          
          const content = await this.downloadFileWithAPIKey(latestFile.id);
          
          if (content && content.includes('Device,Timestamp')) {
            return {
              filename: latestFile.name,
              content: content,
              modifiedTime: latestFile.modifiedTime,
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
export async function getCSVFromGoogleDrive(customFolderId?: string): Promise<{filename: string, content: string, modifiedTime?: string} | null> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    
    if (folderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(folderId);
      if (extracted) {
        folderId = extracted;
      }
    }
    
    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    return await api.getLatestCSV();
    
  } catch (error) {
    console.log('❌ getCSVFromGoogleDrive error:', error);
    return null;
  }
}

/**
 * Fetch multiple recent CSV files from Google Drive and merge their contents.
 * Used for longer time ranges (day/week) that span multiple files.
 * @param maxFiles Maximum number of recent files to fetch
 * @param customFolderId Optional folder ID override
 * @returns Merged CSV content with filename info, or null on failure
 */
export async function getMultipleCSVsFromGoogleDrive(
  maxFiles: number = 7,
  customFolderId?: string,
  sinceDate?: string
): Promise<{filenames: string[], contents: string[], modifiedTimes: string[]} | null> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) {
      console.log('❌ No API key for multi-file fetch');
      return null;
    }

    let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    if (folderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(folderId);
      if (extracted) folderId = extracted;
    }

    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    const files = await api.listFilesWithAPIKey(sinceDate);

    if (!files || files.length === 0) {
      console.log('❌ No files found for multi-CSV fetch');
      return null;
    }

    // ── Sample files at even intervals for full time-range coverage ──
    // If we have 100 files but only want 15, pick every Nth to cover the range
    // Files are sorted newest-first by Drive API
    const MAX_DOWNLOADS = Math.min(maxFiles, 20); // Hard cap: never download more than 20
    let selectedFiles: typeof files;
    if (files.length <= MAX_DOWNLOADS) {
      selectedFiles = files;
    } else {
      // Pick files at even intervals to cover the full range
      selectedFiles = [];
      const step = (files.length - 1) / (MAX_DOWNLOADS - 1);
      for (let i = 0; i < MAX_DOWNLOADS; i++) {
        selectedFiles.push(files[Math.round(i * step)]);
      }
    }
    console.log(`📂 Selected ${selectedFiles.length} of ${files.length} files (sampling every ${files.length <= MAX_DOWNLOADS ? 1 : Math.round(files.length / MAX_DOWNLOADS)} files)`);

    const filenames: string[] = [];
    const contents: string[] = [];
    const modifiedTimes: string[] = [];

    // ── Fast parallel download: no retries, 5s timeout, Sheets export only ──
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 300;
    const OVERALL_DEADLINE = Date.now() + 25_000; // 25s hard deadline
    let cacheHits = 0;

    for (let b = 0; b < selectedFiles.length; b += BATCH_SIZE) {
      // Bail if we're close to the deadline
      if (Date.now() > OVERALL_DEADLINE) {
        console.log(`⏰ Hit 25s deadline after ${contents.length} files, stopping`);
        break;
      }
      if (b > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));

      const batch = selectedFiles.slice(b, b + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          // Check cache first
          const cached = getCachedFile(file.id, file.modifiedTime);
          if (cached) {
            cacheHits++;
            return { file, content: cached };
          }
          // Fast download: no retries, just Sheets export with 5s timeout
          const content = await api.downloadFileQuick(file.id);
          if (content && content.length > 100) {
            setCachedFile(file.id, file.modifiedTime, content);
          }
          return { file, content };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.content && result.value.content.length > 100) {
          filenames.push(result.value.file.name);
          contents.push(result.value.content);
          modifiedTimes.push(result.value.file.modifiedTime);
        }
      }
    }

    console.log(`✅ Got ${contents.length} files (${cacheHits} cached, ${contents.length - cacheHits} fetched) in ${Math.round((Date.now() - (OVERALL_DEADLINE - 25_000)) / 1000)}s`);
    if (contents.length === 0) return null;
    return { filenames, contents, modifiedTimes };
  } catch (error) {
    console.log('❌ getMultipleCSVsFromGoogleDrive error:', error);
    return null;
  }
}

export default SimpleGoogleDriveAPI;