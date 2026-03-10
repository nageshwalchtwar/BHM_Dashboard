// Simplified Google Drive API access using direct API calls
// This provides multiple authentication methods including service accounts
import { extractFolderIdFromUrl } from './device-config';

/**
 * Check whether a string looks like valid CSV sensor data.
 * Matches both old format (Device,Timestamp,X,Y,...) and new format
 * (Timestamp,ax_adxl,ay_adxl,...). Rejects HTML error pages.
 */
function looksLikeCSV(content: string): boolean {
  if (!content || content.length < 50) return false;
  if (content.trimStart().startsWith('<')) return false; // HTML / XML
  const firstLine = content.split('\n')[0].toLowerCase();
  // Must have commas (CSV) and at least one known sensor-related keyword
  const knownKeywords = ['timestamp', 'time', 'device', 'accel', 'adxl', 'wt901', 'stroke', 'temp', 'vibration', 'x,', 'y,', 'z,'];
  return firstLine.includes(',') && knownKeywords.some(k => firstLine.includes(k));
}

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

  async listSubfoldersWithAPIKey(): Promise<Array<{ id: string; name: string; modifiedTime: string }> | null> {
    if (!this.apiKey) {
      console.log('❌ No API key provided for subfolder discovery');
      return null;
    }

    try {
      const query = `'${this.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&orderBy=name asc&pageSize=200&key=${this.apiKey}&fields=files(id,name,modifiedTime)`;

      const response = await this.fetchWithTimeout(url);
      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'timeout or fetch error';
        console.log(`❌ Subfolder listing failed: ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.log('❌ listSubfoldersWithAPIKey error:', error);
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
          
          if (looksLikeCSV(content)) {
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
          if (looksLikeCSV(content)) {
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
        if (looksLikeCSV(content)) {
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
        if (looksLikeCSV(content)) {
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
            if (looksLikeCSV(content)) {
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
          
          if (content && looksLikeCSV(content)) {
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
      
      if (publicContent && looksLikeCSV(publicContent)) {
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
    if (!apiKey || apiKey.startsWith('your_')) {
      console.log('❌ GOOGLE_DRIVE_API_KEY is not configured. Set a real API key in .env.local');
    }
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
    if (!apiKey || apiKey.startsWith('your_')) {
      console.log('❌ No valid API key for multi-file fetch. Set GOOGLE_DRIVE_API_KEY in .env.local');
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

    // ── Download files: take first N (already sorted newest-first by Drive) ──
    const MAX_DOWNLOADS = Math.min(maxFiles, 45); // Hard cap: never download more than 45
    let selectedFiles: typeof files;
    if (files.length <= MAX_DOWNLOADS) {
      selectedFiles = files;
    } else {
      // Take the most recent N files (they're already sorted newest-first)
      selectedFiles = files.slice(0, MAX_DOWNLOADS);
    }
    console.log(`📂 Selected ${selectedFiles.length} of ${files.length} files for download`);

    const filenames: string[] = [];
    const contents: string[] = [];
    const modifiedTimes: string[] = [];

    // ── Fast parallel download: no retries, 5s timeout, Sheets export only ──
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 300;
    const OVERALL_DEADLINE = Date.now() + 50_000; // 50s hard deadline
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

    console.log(`✅ Got ${contents.length} files (${cacheHits} cached, ${contents.length - cacheHits} fetched) in ${Math.round((Date.now() - (OVERALL_DEADLINE - 50_000)) / 1000)}s`);
    if (contents.length === 0) return null;
    return { filenames, contents, modifiedTimes };
  } catch (error) {
    console.log('❌ getMultipleCSVsFromGoogleDrive error:', error);
    return null;
  }
}

/**
 * Fetch a single CSV file for a specific date from Google Drive.
 * Matches by filename date pattern (YYYY-MM-DD) first, then modifiedTime.
 */
export async function getCSVByDate(
  date: string, // YYYY-MM-DD
  customFolderId?: string
): Promise<{filename: string, content: string, modifiedTime?: string} | null> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      console.log('❌ No valid API key for date-based fetch. Set GOOGLE_DRIVE_API_KEY in .env.local');
      return null;
    }

    let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    if (folderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(folderId);
      if (extracted) folderId = extracted;
    }

    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    const files = await api.listFilesWithAPIKey();

    if (!files || files.length === 0) {
      console.log('❌ No files found for date-based fetch');
      return null;
    }

    // Find file matching the requested date (by filename first, then modifiedTime)
    const targetFile = files.find(f => {
      const nameMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (nameMatch && nameMatch[1] === date) return true;
      if (f.modifiedTime && f.modifiedTime.startsWith(date)) return true;
      return false;
    });

    if (!targetFile) {
      console.log(`❌ No file found for date ${date}. Available dates: ${files.slice(0, 10).map(f => f.name).join(', ')}`);
      return null;
    }

    console.log(`📅 Found file for ${date}: ${targetFile.name}`);

    // Check cache
    const cached = getCachedFile(targetFile.id, targetFile.modifiedTime);
    if (cached) {
      console.log(`⚡ Cache hit for ${targetFile.name}`);
      return { filename: targetFile.name, content: cached, modifiedTime: targetFile.modifiedTime };
    }

    const content = await api.downloadFileWithAPIKey(targetFile.id);
    if (content && content.length > 100) {
      setCachedFile(targetFile.id, targetFile.modifiedTime, content);
      return { filename: targetFile.name, content, modifiedTime: targetFile.modifiedTime };
    }

    console.log(`❌ Failed to download file for date ${date}`);
    return null;
  } catch (error) {
    console.log('❌ getCSVByDate error:', error);
    return null;
  }
}

/**
 * Get list of available dates that have data files.
 * Used to show which dates are available in the date picker.
 */
export async function getAvailableDates(
  customFolderId?: string
): Promise<string[]> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) return [];

    let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    if (folderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(folderId);
      if (extracted) folderId = extracted;
    }

    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    const files = await api.listFilesWithAPIKey();

    if (!files || files.length === 0) return [];

    return files.map(f => {
      const nameMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (nameMatch) return nameMatch[1];
      return f.modifiedTime.split('T')[0];
    }).filter((d, i, arr) => arr.indexOf(d) === i); // unique dates
  } catch {
    return [];
  }
}

export async function getDriveSubfolders(
  parentFolderIdOrUrl?: string
): Promise<Array<{ id: string; name: string; modifiedTime?: string; folderUrl: string }>> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) return [];

    let parentFolderId =
      parentFolderIdOrUrl ||
      process.env.GOOGLE_DRIVE_PARENT_FOLDER_URL ||
      process.env.RAILWAY_GOOGLE_DRIVE_PARENT_FOLDER_URL ||
      process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      '';

    if (!parentFolderId) return [];

    if (parentFolderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(parentFolderId);
      if (extracted) parentFolderId = extracted;
    }

    const api = new SimpleGoogleDriveAPI(parentFolderId, apiKey);
    const folders = await api.listSubfoldersWithAPIKey();
    if (!folders || folders.length === 0) return [];

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      modifiedTime: folder.modifiedTime,
      folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
    }));
  } catch {
    return [];
  }
}

export default SimpleGoogleDriveAPI;