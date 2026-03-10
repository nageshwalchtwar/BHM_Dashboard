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
  const knownKeywords = ['timestamp', 'time', 'device', 'accel', 'adxl', 'wt901', 'stroke', 'temp', 'vibration', 'x,', 'y,', 'z,', 'date', 'sensor', 'data', 'value', 'reading'];
  const hasCommasAndKeyword = firstLine.includes(',') && knownKeywords.some(k => firstLine.includes(k));
  // Also accept any file where the first line has commas and subsequent lines have numeric data
  if (!hasCommasAndKeyword && firstLine.includes(',') && content.split('\n').length > 2) {
    const secondLine = content.split('\n')[1];
    // If second line contains numbers with commas, it's likely CSV data
    if (secondLine && /\d/.test(secondLine) && secondLine.includes(',')) {
      return true;
    }
  }
  return hasCommasAndKeyword;
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
  private async fetchWithTimeout(url: string, opts: any = {}, timeoutMs = 30000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal })
      return res
    } catch (err) {
      console.log(`❌ fetch failed for ${url.substring(0, 80)}...:`, err instanceof Error ? err.message : String(err))
      return null
    } finally {
      clearTimeout(id)
    }
  }

  // Method 1: Try with API Key (if folder is publicly shared)
  async listFilesWithAPIKey(sinceDate?: string): Promise<Array<{id: string, name: string, modifiedTime: string, mimeType?: string}> | null> {
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
        const errorText = response ? await response.text() : 'timeout or fetch error'
        console.log(`❌ API key request failed: HTTP ${response?.status || 'N/A'}`);
        console.log(`📄 Error response: ${errorText.substring(0, 500)}`);
        // Parse Google error for actionable message
        try {
          const errJson = JSON.parse(errorText);
          const reason = errJson?.error?.errors?.[0]?.reason || '';
          if (response?.status === 404 || reason === 'notFound') {
            console.log('💡 Folder not found. Check that the folder ID is correct.');
          } else if (response?.status === 403 || reason === 'forbidden' || reason === 'dailyLimitExceeded') {
            console.log('💡 Access denied. The folder must be shared as "Anyone with the link" for API key access.');
          } else if (response?.status === 401) {
            console.log('💡 API key rejected. Verify the key is valid and Google Drive API is enabled in the Cloud Console.');
          }
        } catch {}
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
      console.log('❌ downloadFileWithAPIKey: No API key available');
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

        // Try Drive API alt=media first (works for both actual CSVs and Sheets)
        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
        const response = await this.fetchWithTimeout(driveUrl);
        
        if (response && response.ok) {
          const content = await response.text();
          if (looksLikeCSV(content)) {
            return content;
          }
          console.log(`⚠️ Drive API returned content but looksLikeCSV=false for ${fileId}. First 200 chars: ${content.substring(0, 200)}`);
        } else if (response && response.status === 429) {
          console.log(`⚠️ Rate limited on Drive API for ${fileId}`);
          continue;
        } else if (response) {
          const errText = await response.text().catch(() => '');
          console.log(`⚠️ Drive API download failed for ${fileId}: HTTP ${response.status} — ${errText.substring(0, 300)}`);
        }

        // Fallback: try Google Sheets export (works if file is a Google Sheet)
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
          console.log(`⚠️ Sheets export returned content but looksLikeCSV=false for ${fileId}. First 200 chars: ${content.substring(0, 200)}`);
        } else if (exportResponse && exportResponse.status === 429) {
          // Rate limited — retry
          console.log(`⚠️ Rate limited on Sheets export for ${fileId}`);
          continue;
        } else if (exportResponse) {
          console.log(`⚠️ Sheets export failed for ${fileId}: HTTP ${exportResponse.status}`);
        }
        
        console.log(`❌ Both download methods failed for fileId=${fileId} (attempt ${attempt + 1}/${retries + 1})`);
        if (attempt === retries) return null;
        
      } catch (error) {
        if (attempt === retries) {
          console.log('❌ Download error:', error);
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Download only the tail of a file using HTTP Range header.
   * Useful for "1 minute" mode where we only need the last ~60s of data.
   * @param fileId Google Drive file ID
   * @param tailBytes Number of bytes from the end to download (default 512KB)
   */
  async downloadFileTail(fileId: string, tailBytes = 512 * 1024): Promise<string | null> {
    if (!this.apiKey) return null;
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
      const response = await this.fetchWithTimeout(url, {
        headers: { 'Range': `bytes=-${tailBytes}` }
      }, 20000);

      if (!response) return null;

      // 206 = partial content (Range worked), 200 = file smaller than range (full file)
      if (response.status === 206 || response.status === 200) {
        const content = await response.text();
        if (response.status === 206) {
          // Drop first partial line (may be cut mid-row)
          const newlineIdx = content.indexOf('\n');
          if (newlineIdx > 0 && newlineIdx < 500) {
            return content.substring(newlineIdx + 1);
          }
        }
        return content;
      }
      console.log(`⚠️ Range download returned HTTP ${response.status} for ${fileId}`);
      return null;
    } catch (err) {
      console.log(`⚠️ downloadFileTail error for ${fileId}:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  // Fast single-attempt download for batch use — no retries, 15s timeout
  async downloadFileQuick(fileId: string): Promise<string | null> {
    try {
      // Try Drive API first (works for actual CSV files and Sheets)
      const driveResponse = await this.fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`,
        {},
        15000
      );
      if (driveResponse && driveResponse.ok) {
        const content = await driveResponse.text();
        if (looksLikeCSV(content)) {
          return content;
        }
      }

      // Fallback to Sheets export (for Google Sheets files)
      const exportResponse = await this.fetchWithTimeout(
        `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BHM-Dashboard/1.0)',
            'Accept': 'text/csv,application/csv,text/plain,*/*'
          }
        },
        15000
      );

      if (exportResponse && exportResponse.ok) {
        const content = await exportResponse.text();
        if (looksLikeCSV(content)) {
          return content;
        }
      }

      // Already tried Drive API above; no additional fallback needed

      return null;
    } catch {
      return null;
    }
  }

  // ── Google Sheets API: fetch only the rows you need ─────────────────

  /** Get total row count of the first sheet in a Spreadsheet */
  async getSheetRowCount(fileId: string): Promise<number | null> {
    if (!this.apiKey) return null;
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets(properties(gridProperties))&key=${this.apiKey}`;
      const resp = await this.fetchWithTimeout(url, {}, 10000);
      if (!resp || !resp.ok) {
        console.log(`⚠️ Sheets metadata failed for ${fileId}: HTTP ${resp?.status}`);
        return null;
      }
      const data = await resp.json();
      return data.sheets?.[0]?.properties?.gridProperties?.rowCount ?? null;
    } catch { return null; }
  }

  /** Fetch specific row ranges from a Google Sheet and return as CSV text */
  async fetchSheetRangesAsCSV(fileId: string, ranges: string[]): Promise<string | null> {
    if (!this.apiKey || !ranges.length) return null;
    try {
      const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${params}&key=${this.apiKey}&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
      const resp = await this.fetchWithTimeout(url, {}, 25000);
      if (!resp || !resp.ok) {
        const errText = resp ? await resp.text().catch(() => '') : '';
        console.log(`⚠️ Sheets batchGet failed for ${fileId}: HTTP ${resp?.status} — ${errText.substring(0, 300)}`);
        return null;
      }
      const data = await resp.json();
      const lines: string[] = [];
      for (const vr of (data.valueRanges || [])) {
        for (const row of (vr.values || [])) {
          lines.push(row.map((c: any) => String(c ?? '')).join(','));
        }
      }
      return lines.length >= 2 ? lines.join('\n') : null;
    } catch (e) {
      console.log('❌ fetchSheetRangesAsCSV error:', e);
      return null;
    }
  }

  /** Fetch header + last N rows from a Google Sheet (for 1-min mode) */
  async fetchSheetTail(fileId: string, tailRows = 3000): Promise<string | null> {
    const total = await this.getSheetRowCount(fileId);
    if (!total || total < 2) return null;
    const start = Math.max(2, total - tailRows + 1);
    console.log(`📊 Sheets tail: rows ${start}–${total} of ${total}`);
    return this.fetchSheetRangesAsCSV(fileId, ['1:1', `${start}:${total}`]);
  }

  /** Fetch header + evenly-sampled chunks from a Google Sheet (for date/week modes) */
  async fetchSheetSampled(fileId: string, chunkRows = 400, maxChunks = 49): Promise<string | null> {
    const total = await this.getSheetRowCount(fileId);
    if (!total || total < 2) return null;
    const dataRows = total - 1;
    const numChunks = Math.min(maxChunks, Math.ceil(dataRows / chunkRows));
    const step = Math.max(chunkRows, Math.floor(dataRows / numChunks));

    const ranges: string[] = ['1:1']; // header
    for (let i = 0; i < numChunks; i++) {
      const s = 2 + i * step;
      if (s > total) break;
      const e = Math.min(s + chunkRows - 1, total);
      ranges.push(`${s}:${e}`);
    }

    console.log(`📊 Sheets sampled: ${ranges.length - 1} chunks of ~${chunkRows} rows from ${total} total (${ranges.length} ranges)`);
    return this.fetchSheetRangesAsCSV(fileId, ranges);
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
      console.log('\ud83c\udfaf Getting latest CSV using Simple Google Drive API...');
      
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
  /**
   * Optimised latest-file fetch for \"1 minute\" mode.
   * 1. List files to find the latest.
   * 2. Try Range-based tail download (only last ~512KB) — much faster for big files.
   * 3. If that fails, fall back to full download.
   * Returns the CSV header (for the streaming parser) + content.
   */
  async getLatestCSVOptimized(): Promise<{
    filename: string;
    content: string;
    header: string | null;  // null = content includes header; string = header provided separately (tail download)
    modifiedTime?: string;
  } | null> {
    if (!this.apiKey) return null;
    try {
      const files = await this.listFilesWithAPIKey();
      if (!files || files.length === 0) return null;
      const latest = files[0];
      console.log(`⚡ Optimised fetch for ${latest.name}`);

      // Check content cache first
      const cached = getCachedFile(latest.id, latest.modifiedTime);
      if (cached) {
        console.log(`⚡ Cache hit for ${latest.name} (${cached.length} chars)`);
        return { filename: latest.name, content: cached, header: null, modifiedTime: latest.modifiedTime };
      }

      // Step 1: Try Range-based tail download (fast for large files)
      const tailContent = await this.downloadFileTail(latest.id, 512 * 1024);
      if (tailContent && tailContent.length > 100) {
        // Fetch header row from the first 1KB of the file
        let headerRow: string | null = null;
        try {
          const url = `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media&key=${this.apiKey}`;
          const hdrResp = await this.fetchWithTimeout(url, { headers: { 'Range': 'bytes=0-1023' } }, 8000);
          if (hdrResp && (hdrResp.status === 206 || hdrResp.status === 200)) {
            const hdrText = await hdrResp.text();
            const firstNewline = hdrText.indexOf('\n');
            if (firstNewline > 0) {
              headerRow = hdrText.substring(0, firstNewline).trim();
            }
          }
        } catch {}

        if (headerRow && looksLikeCSVHeader(headerRow)) {
          console.log(`\u2705 Tail download: ${tailContent.length} chars with header`);
          return { filename: latest.name, content: tailContent, header: headerRow, modifiedTime: latest.modifiedTime };
        }
        // If we can't get header, the tail content may still include header if file was small
        if (looksLikeCSV(tailContent)) {
          setCachedFile(latest.id, latest.modifiedTime, tailContent);
          return { filename: latest.name, content: tailContent, header: null, modifiedTime: latest.modifiedTime };
        }
      }

      // Step 2: Fallback to full download
      console.log(`\u23ec Falling back to full download for ${latest.name}`);
      const content = await this.downloadFileWithAPIKey(latest.id);
      if (content && looksLikeCSV(content)) {
        setCachedFile(latest.id, latest.modifiedTime, content);
        return { filename: latest.name, content, header: null, modifiedTime: latest.modifiedTime };
      }
      return null;
    } catch (error) {
      console.log('\u274c getLatestCSVOptimized error:', error);
      return null;
    }
  }
}

/** Check if a single line looks like a CSV header row */
function looksLikeCSVHeader(line: string): boolean {
  const lower = line.toLowerCase();
  const keywords = ['timestamp', 'time', 'accel', 'adxl', 'wt901', 'stroke', 'temp', 'x,', 'y,', 'z,', 'device'];
  return lower.includes(',') && keywords.some(k => lower.includes(k));}

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
 * Optimised CSV fetch for "1 minute" mode.
 * Uses Range-based partial download to avoid fetching the entire large file.
 */
export async function getCSVFromGoogleDriveOptimized(customFolderId?: string): Promise<{
  filename: string; content: string; header: string | null; modifiedTime?: string;
} | null> {
  try {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) return null;
    let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
    if (folderId.includes('http')) {
      const extracted = extractFolderIdFromUrl(folderId);
      if (extracted) folderId = extracted;
    }
    const api = new SimpleGoogleDriveAPI(folderId, apiKey);
    return await api.getLatestCSVOptimized();
  } catch (error) {
    console.log('❌ getCSVFromGoogleDriveOptimized error:', error);
    return null;
  }
}

/**
 * Batch-fetch the TAIL of the latest file using Google Sheets API.
 * Only reads the last ~3000 rows instead of downloading the entire file.
 * Falls back to full download for non-Sheet files.
 */
export async function getCSVBatchTail(
  customFolderId?: string,
  tailRows: number = 3000
): Promise<{ filename: string; content: string; modifiedTime?: string } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) return null;
  let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
  if (folderId.includes('http')) {
    const extracted = extractFolderIdFromUrl(folderId);
    if (extracted) folderId = extracted;
  }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) return null;

  const latest = files[0];
  // Use Sheets API for Google Sheets files (batch-read only needed rows)
  if (latest.mimeType === 'application/vnd.google-apps.spreadsheet') {
    console.log(`📊 Sheets API batch tail for ${latest.name}`);
    const content = await api.fetchSheetTail(latest.id, tailRows);
    if (content && content.length > 100) {
      return { filename: latest.name, content, modifiedTime: latest.modifiedTime };
    }
    console.log('⚠️ Sheets API tail failed, trying full download...');
  }

  // Fallback: full download
  return api.getLatestCSV();
}

/**
 * Batch-fetch sampled rows from a specific date's Google Sheet.
 * Reads evenly-spaced chunks instead of the entire file.
 */
export async function getCSVBatchSampled(
  customFolderId?: string,
  options?: { date?: string; chunkRows?: number; maxChunks?: number }
): Promise<{ filename: string; content: string; modifiedTime?: string } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) return null;
  let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
  if (folderId.includes('http')) {
    const extracted = extractFolderIdFromUrl(folderId);
    if (extracted) folderId = extracted;
  }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) return null;

  // Find target file (latest or matching date)
  let target = files[0];
  if (options?.date) {
    const found = files.find(f => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (m && m[1] === options.date) return true;
      return f.modifiedTime?.startsWith(options.date!) ?? false;
    });
    if (!found) { console.log(`❌ No file found for date ${options.date}`); return null; }
    target = found;
  }

  if (target.mimeType === 'application/vnd.google-apps.spreadsheet') {
    console.log(`📊 Sheets API sampled batch for ${target.name}`);
    const content = await api.fetchSheetSampled(target.id, options?.chunkRows || 400, options?.maxChunks || 49);
    if (content && content.length > 100) {
      return { filename: target.name, content, modifiedTime: target.modifiedTime };
    }
    console.log('⚠️ Sheets API sampled failed, trying full download...');
  }

  // Fallback: full download
  const content = await api.downloadFileWithAPIKey(target.id);
  if (content && content.length > 100) {
    return { filename: target.name, content, modifiedTime: target.modifiedTime };
  }
  return null;
}

/**
 * Batch-fetch sampled rows from multiple files (for week mode).
 * Uses Sheets API to read only sampled chunks from each file.
 */
export async function getMultipleCSVsBatch(
  maxFiles: number = 7,
  customFolderId?: string,
  chunkRows: number = 400,
  maxChunksPerFile: number = 20
): Promise<{ filenames: string[]; contents: string[]; modifiedTimes: string[] } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) return null;
  let folderId = customFolderId || process.env.RAILWAY_GOOGLE_DRIVE_FOLDER_URL || process.env.GOOGLE_DRIVE_FOLDER_ID || '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';
  if (folderId.includes('http')) {
    const extracted = extractFolderIdFromUrl(folderId);
    if (extracted) folderId = extracted;
  }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) return null;

  const selected = files.slice(0, Math.min(maxFiles, files.length));
  const filenames: string[] = [];
  const contents: string[] = [];
  const modifiedTimes: string[] = [];

  // Process 3 files in parallel at a time
  for (let i = 0; i < selected.length; i += 3) {
    const batch = selected.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        let csv: string | null = null;
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          csv = await api.fetchSheetSampled(file.id, chunkRows, maxChunksPerFile);
        }
        if (!csv) {
          csv = await api.downloadFileQuick(file.id);
        }
        return { file, csv };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.csv && r.value.csv.length > 100) {
        filenames.push(r.value.file.name);
        contents.push(r.value.csv);
        modifiedTimes.push(r.value.file.modifiedTime);
      }
    }
  }

  if (contents.length === 0) return null;
  console.log(`✅ Batch fetched ${contents.length} files via Sheets API`);
  return { filenames, contents, modifiedTimes };
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