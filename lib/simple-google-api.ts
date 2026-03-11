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
  private async fetchWithTimeout(url: string, opts: any = {}, timeoutMs = 120000) {
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
  async listFilesWithAPIKey(sinceDate?: string): Promise<Array<{id: string, name: string, modifiedTime: string, mimeType?: string, size?: string}> | null> {
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
   * Download the header line (first 1 KB) + tail of a large file via two Range requests.
   * This is the only viable approach for 1+ GB CSV files.
   * @param fileId Google Drive file ID
   * @param tailBytes How many bytes from the end to download (default 30 MB)
   */
  async downloadFileTailWithHeader(fileId: string, tailBytes = 30 * 1024 * 1024): Promise<string | null> {
    if (!this.apiKey) return null;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
    try {
      // Step 1: grab the header row (first 1 KB — header lines are never > 500 bytes)
      const hdrResp = await this.fetchWithTimeout(url, { headers: { 'Range': 'bytes=0-1023' } }, 15000);
      if (!hdrResp || (hdrResp.status !== 206 && hdrResp.status !== 200)) {
        console.log(`⚠️ Header fetch failed for ${fileId}: HTTP ${hdrResp?.status}`);
        return null;
      }
      const hdrContent = await hdrResp.text();
      const headerEnd = hdrContent.indexOf('\n');
      const headerLine = headerEnd > 0 ? hdrContent.substring(0, headerEnd).trim() : hdrContent.trim();
      if (!headerLine || !headerLine.includes(',')) {
        console.log(`⚠️ Could not extract header from ${fileId}`);
        return null;
      }

      // Step 2: grab the tail
      const tailResp = await this.fetchWithTimeout(url, { headers: { 'Range': `bytes=-${tailBytes}` } }, 45000);
      if (!tailResp || (tailResp.status !== 206 && tailResp.status !== 200)) {
        console.log(`⚠️ Tail fetch failed for ${fileId}: HTTP ${tailResp?.status}`);
        return null;
      }
      const tailContent = await tailResp.text();

      // Drop the first line of the tail (it's a partial row cut at the byte boundary)
      const firstNl = tailContent.indexOf('\n');
      const cleanTail = firstNl > 0 ? tailContent.substring(firstNl + 1) : tailContent;

      const combined = headerLine + '\n' + cleanTail;
      console.log(`✅ Tail download: header + ${Math.round(tailBytes / (1024 * 1024))}MB tail = ${Math.round(combined.length / 1024)}KB total`);
      return combined;
    } catch (err) {
      console.log(`⚠️ downloadFileTailWithHeader error for ${fileId}:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * Download only the tail of a file using HTTP Range header.
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

      if (response.status === 206 || response.status === 200) {
        const content = await response.text();
        if (response.status === 206) {
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
        25000
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
        25000
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

  // ── Byte-range sampling: download small chunks from evenly-spaced positions ──

  /** Download a specific byte range from a Drive file */
  async downloadByteRange(fileId: string, start: number, end: number): Promise<string | null> {
    if (!this.apiKey) return null;
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
      const resp = await this.fetchWithTimeout(url, {
        headers: { 'Range': `bytes=${start}-${end}` }
      }, 15000);
      if (!resp || (resp.status !== 206 && resp.status !== 200)) return null;
      return resp.text();
    } catch { return null; }
  }

  /**
   * Sample a large CSV by downloading small byte ranges from evenly-spaced positions.
   * Returns the header line + array of clean CSV chunk texts (partial rows trimmed).
   */
  async sampleFileByByteRanges(
    fileId: string,
    fileSizeBytes: number,
    numSamples: number = 100,
    bytesPerSample: number = 50 * 1024  // 50 KB per sample
  ): Promise<{ header: string; chunks: string[] } | null> {
    // Step 1: Get header from first 2 KB
    const headerResp = await this.downloadByteRange(fileId, 0, 2047);
    if (!headerResp) return null;
    const headerEnd = headerResp.indexOf('\n');
    if (headerEnd <= 0) return null;
    const header = headerResp.substring(0, headerEnd).trim();
    if (!looksLikeCSVHeader(header)) {
      console.log(`⚠️ sampleFileByByteRanges: header doesn't look like CSV: ${header.substring(0, 100)}`);
      return null;
    }

    // Step 2: Compute byte offsets for evenly-spaced samples
    const usableSize = fileSizeBytes - 2048; // skip header region
    if (usableSize < bytesPerSample * 2) return null; // file too small for sampling
    const step = Math.floor(usableSize / numSamples);

    const offsets: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < numSamples; i++) {
      const start = 2048 + i * step;
      const end = Math.min(start + bytesPerSample - 1, fileSizeBytes - 1);
      offsets.push({ start, end });
    }

    console.log(`📊 Byte-range sampling: ${offsets.length} chunks of ~${Math.round(bytesPerSample / 1024)}KB from ${Math.round(fileSizeBytes / (1024 * 1024))}MB file`);

    // Step 3: Download in parallel batches of 5
    const chunks: string[] = [];
    const BATCH = 5;
    for (let i = 0; i < offsets.length; i += BATCH) {
      const batch = offsets.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(o => this.downloadByteRange(fileId, o.start, o.end))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.length > 50) {
          // Drop first line (likely partial) and last line (likely partial)
          const lines = r.value.split('\n');
          if (lines.length >= 3) {
            const cleanLines = lines.slice(1, -1).filter(l => l.length > 5);
            if (cleanLines.length > 0) {
              chunks.push(cleanLines.join('\n'));
            }
          }
        }
      }
    }

    console.log(`✅ Got ${chunks.length}/${offsets.length} valid chunks`);
    return chunks.length > 0 ? { header, chunks } : null;
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

  /**
   * Stream a Google Drive file line-by-line and compute RMS windows in real time.
   * NEVER buffers the full file in memory — O(window_size) during download.
   * Handles 1+ GB files by piping the HTTP response body through a line parser.
   *
   * @param fileId   Google Drive file ID
   * @param windowMs RMS window in milliseconds (1000 = 1 second)
   * @param fileDate Optional YYYY-MM-DD for resolving time-only timestamps (HH:MM:SS)
   */
  async streamAndComputeRMS(
    fileId: string,
    windowMs: number,
    fileDate?: string,
  ): Promise<{ rmsData: any[]; rawRowCount: number } | null> {
    if (!this.apiKey) return null;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
    let resp: Response;
    try {
      resp = await fetch(url); // No timeout — must run to completion for streaming
    } catch (err) {
      console.log(`❌ streamAndComputeRMS: fetch error:`, err);
      return null;
    }
    if (!resp.ok || !resp.body) {
      console.log(`❌ streamAndComputeRMS: HTTP ${resp?.status} for ${fileId}`);
      return null;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    // Column indices set when header is parsed
    let headers: string[] | null = null;
    let tsIdx = -1;
    let axAIdx = -1, ayAIdx = -1, azAIdx = -1;
    let axWIdx = -1, ayWIdx = -1, azWIdx = -1;
    let acxIdx = -1, acyIdx = -1, aczIdx = -1;
    let strIdx = -1, tmpIdx = -1;

    const dateRef = fileDate ? new Date(fileDate) : new Date();
    const parseTs = (raw: string): number => {
      const s = raw.trim();
      if (s.match(/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/)) {
        const [hh, mm, sp] = s.split(':');
        const sec = parseFloat(sp || '0');
        return Date.UTC(dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
          parseInt(hh), parseInt(mm), Math.floor(sec), Math.round((sec % 1) * 1000));
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const pf = (v: string[], i: number): number => {
      if (i < 0 || i >= v.length) return 0;
      const n = parseFloat(v[i]?.trim() || '');
      return isNaN(n) ? 0 : n;
    };

    // RMS window state
    const rmsData: any[] = [];
    let rawRowCount = 0;
    let wStart = 0, wFirstRaw = '';
    let wAxA: number[] = [], wAyA: number[] = [], wAzA: number[] = [];
    let wAxW: number[] = [], wAyW: number[] = [], wAzW: number[] = [];
    let wAx: number[] = [], wAy: number[] = [], wAz: number[] = [];
    let wSt: number[] = [], wTp: number[] = [];

    const rms = (a: number[]) => a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : 0;
    const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

    const flushWindow = () => {
      if (!wAx.length && !wAxA.length) return;
      const axR = rms(wAx) || rms(wAxA), ayR = rms(wAy) || rms(wAyA), azR = rms(wAz) || rms(wAzA);
      rmsData.push({
        timestamp: wStart, rawTimestamp: wFirstRaw,
        ax_adxl: rms(wAxA), ay_adxl: rms(wAyA), az_adxl: rms(wAzA),
        ax_wt901: rms(wAxW), ay_wt901: rms(wAyW), az_wt901: rms(wAzW),
        accel_x: axR, accel_y: ayR, accel_z: azR,
        x: axR, y: ayR, z: azR, vibration: axR, acceleration: ayR,
        stroke_mm: mean(wSt), strain: mean(wSt),
        temperature_c: wTp.at(-1) ?? 0, temperature: wTp.at(-1) ?? 0,
      });
    };
    const resetWindow = (ts: number, raw: string) => {
      wStart = ts; wFirstRaw = raw;
      wAxA = []; wAyA = []; wAzA = [];
      wAxW = []; wAyW = []; wAzW = [];
      wAx = []; wAy = []; wAz = [];
      wSt = []; wTp = [];
    };

    const processLine = (line: string) => {
      if (!line || line.length < 5) return;

      if (headers === null) {
        // Detect header: has commas and starts with a non-digit
        if (line.includes(',') && !/^\d/.test(line.trimStart())) {
          const raw = line.split(',').map(h => h.trim());
          const h = raw.map(s => s.toLowerCase());
          const col = (n: string) => h.indexOf(n);
          tsIdx = Math.max(col('timestamp'), col('time'), col('ts'));
          axAIdx = col('ax_adxl'); ayAIdx = col('ay_adxl'); azAIdx = col('az_adxl');
          axWIdx = col('ax_wt901'); ayWIdx = col('ay_wt901'); azWIdx = col('az_wt901');
          acxIdx = col('accel_x') >= 0 ? col('accel_x') : col('x');
          acyIdx = col('accel_y') >= 0 ? col('accel_y') : col('y');
          aczIdx = col('accel_z') >= 0 ? col('accel_z') : col('z');
          strIdx = col('stroke_mm');
          tmpIdx = [col('temp_c'), col('temperature_c'), col('temperature')].find(i => i >= 0) ?? -1;
          headers = raw;
          console.log(`📋 Header: ${raw.length} cols | ts=${tsIdx} axAdxl=${axAIdx} wt901=${axWIdx}`);
        }
        return;
      }

      if (tsIdx < 0) return;
      const vals = line.split(',');
      if (vals.length < headers.length - 1) return;
      const ts = parseTs(vals[tsIdx]);
      if (ts === 0) return;

      if (wStart === 0) resetWindow(ts, vals[tsIdx]?.trim() || '');

      if (ts - wStart >= windowMs) {
        flushWindow();
        resetWindow(ts, vals[tsIdx]?.trim() || '');
      }

      rawRowCount++;
      wAxA.push(pf(vals, axAIdx)); wAyA.push(pf(vals, ayAIdx)); wAzA.push(pf(vals, azAIdx));
      wAxW.push(pf(vals, axWIdx)); wAyW.push(pf(vals, ayWIdx)); wAzW.push(pf(vals, azWIdx));
      wAx.push(pf(vals, acxIdx) || pf(vals, axAIdx));
      wAy.push(pf(vals, acyIdx) || pf(vals, ayAIdx));
      wAz.push(pf(vals, aczIdx) || pf(vals, azAIdx));
      wSt.push(pf(vals, strIdx));
      wTp.push(pf(vals, tmpIdx));
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buf.trim()) processLine(buf.trim());
          flushWindow(); // flush last window
          break;
        }
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          processLine(buf.substring(0, nl).trim());
          buf = buf.substring(nl + 1);
        }
      }
    } catch (err) {
      console.log(`⚠️ Stream interrupted for ${fileId}:`, err);
      if (rawRowCount === 0) return null;
      // Return partial result — still useful
    } finally {
      reader.releaseLock();
    }

    if (rawRowCount === 0) {
      console.log(`❌ streamAndComputeRMS: no rows parsed from ${fileId}`);
      return null;
    }
    console.log(`✅ Streamed ${rawRowCount} rows → ${rmsData.length} RMS points (${windowMs}ms windows)`);
    return { rmsData, rawRowCount };
  }

  /**
   * Stream a Google Drive file line-by-line and pick ONE raw data point per second.
   * No RMS computation — just the first row in each 1-second window.
   * Extremely low processing cost: O(1) work per window.
   */
  async streamAndPickOneSample(
    fileId: string,
    windowMs: number = 1000,
    fileDate?: string,
  ): Promise<{ sampledData: any[]; rawRowCount: number } | null> {
    if (!this.apiKey) return null;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.apiKey}`;
    let resp: Response;
    try {
      resp = await fetch(url);
    } catch (err) {
      console.log(`❌ streamAndPickOneSample: fetch error:`, err);
      return null;
    }
    if (!resp.ok || !resp.body) {
      console.log(`❌ streamAndPickOneSample: HTTP ${resp?.status} for ${fileId}`);
      return null;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    let headers: string[] | null = null;
    let tsIdx = -1;
    let axAIdx = -1, ayAIdx = -1, azAIdx = -1;
    let axWIdx = -1, ayWIdx = -1, azWIdx = -1;
    let acxIdx = -1, acyIdx = -1, aczIdx = -1;
    let strIdx = -1, tmpIdx = -1;

    const dateRef = fileDate ? new Date(fileDate) : new Date();
    const parseTs = (raw: string): number => {
      const s = raw.trim();
      if (s.match(/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/)) {
        const [hh, mm, sp] = s.split(':');
        const sec = parseFloat(sp || '0');
        return Date.UTC(dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
          parseInt(hh), parseInt(mm), Math.floor(sec), Math.round((sec % 1) * 1000));
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const pf = (v: string[], i: number): number => {
      if (i < 0 || i >= v.length) return 0;
      const n = parseFloat(v[i]?.trim() || '');
      return isNaN(n) ? 0 : n;
    };

    const sampledData: any[] = [];
    let rawRowCount = 0;
    let currentWindowStart = 0;
    let pickedForWindow = false; // true = already picked a sample for the current window

    const processLine = (line: string) => {
      if (!line || line.length < 5) return;

      if (headers === null) {
        if (line.includes(',') && !/^\d/.test(line.trimStart())) {
          const raw = line.split(',').map(h => h.trim());
          const h = raw.map(s => s.toLowerCase());
          const col = (n: string) => h.indexOf(n);
          tsIdx = Math.max(col('timestamp'), col('time'), col('ts'));
          axAIdx = col('ax_adxl'); ayAIdx = col('ay_adxl'); azAIdx = col('az_adxl');
          axWIdx = col('ax_wt901'); ayWIdx = col('ay_wt901'); azWIdx = col('az_wt901');
          acxIdx = col('accel_x') >= 0 ? col('accel_x') : col('x');
          acyIdx = col('accel_y') >= 0 ? col('accel_y') : col('y');
          aczIdx = col('accel_z') >= 0 ? col('accel_z') : col('z');
          strIdx = col('stroke_mm');
          tmpIdx = [col('temp_c'), col('temperature_c'), col('temperature')].find(i => i >= 0) ?? -1;
          headers = raw;
        }
        return;
      }

      if (tsIdx < 0) return;
      const vals = line.split(',');
      if (vals.length < headers.length - 1) return;
      const ts = parseTs(vals[tsIdx]);
      if (ts === 0) return;

      rawRowCount++;

      // New window?
      if (currentWindowStart === 0) {
        currentWindowStart = ts;
        pickedForWindow = false;
      } else if (ts - currentWindowStart >= windowMs) {
        // Advance to new window
        currentWindowStart = ts;
        pickedForWindow = false;
      }

      // Pick the first row in each window — skip rest
      if (pickedForWindow) return;
      pickedForWindow = true;

      const axA = pf(vals, axAIdx), ayA = pf(vals, ayAIdx), azA = pf(vals, azAIdx);
      const axW = pf(vals, axWIdx), ayW = pf(vals, ayWIdx), azW = pf(vals, azWIdx);
      const acx = pf(vals, acxIdx) || axA, acy = pf(vals, acyIdx) || ayA, acz = pf(vals, aczIdx) || azA;
      const stroke = pf(vals, strIdx), temp = pf(vals, tmpIdx);

      sampledData.push({
        timestamp: ts, rawTimestamp: vals[tsIdx]?.trim() || '',
        ax_adxl: axA, ay_adxl: ayA, az_adxl: azA,
        ax_wt901: axW, ay_wt901: ayW, az_wt901: azW,
        accel_x: acx, accel_y: acy, accel_z: acz,
        x: acx, y: acy, z: acz, vibration: acx, acceleration: acy,
        stroke_mm: stroke, strain: stroke,
        temperature_c: temp, temperature: temp,
      });
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buf.trim()) processLine(buf.trim());
          break;
        }
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          processLine(buf.substring(0, nl).trim());
          buf = buf.substring(nl + 1);
        }
      }
    } catch (err) {
      console.log(`⚠️ Stream interrupted for ${fileId}:`, err);
      if (rawRowCount === 0) return null;
    } finally {
      reader.releaseLock();
    }

    if (rawRowCount === 0) {
      console.log(`❌ streamAndPickOneSample: no rows parsed from ${fileId}`);
      return null;
    }
    console.log(`✅ Streamed ${rawRowCount} rows → ${sampledData.length} sample points (1 per ${windowMs}ms)`);
    return { sampledData, rawRowCount };
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
  // Use Sheets API for Google Sheets files
  if (latest.mimeType === 'application/vnd.google-apps.spreadsheet') {
    console.log(`📊 Sheets API batch tail for ${latest.name}`);
    const content = await api.fetchSheetTail(latest.id, tailRows);
    if (content && content.length > 100) {
      return { filename: latest.name, content, modifiedTime: latest.modifiedTime };
    }
  }

  // For actual CSV files: use Range-based tail download (last 512KB)
  const tailContent = await api.downloadFileTail(latest.id, 512 * 1024);
  if (tailContent && tailContent.length > 100) {
    // Fetch header separately
    let headerRow: string | null = null;
    const hdrResp = await api.downloadByteRange(latest.id, 0, 1023);
    if (hdrResp) {
      const nl = hdrResp.indexOf('\n');
      if (nl > 0) headerRow = hdrResp.substring(0, nl).trim();
    }
    const content = headerRow ? headerRow + '\n' + tailContent : tailContent;
    return { filename: latest.name, content, modifiedTime: latest.modifiedTime };
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
  }

  // For actual CSV files: byte-range sampling
  const fileSize = parseInt(target.size || '0', 10);
  if (fileSize > 500_000) { // Only sample if file > 500KB
    console.log(`📊 Byte-range sampling for ${target.name} (${Math.round(fileSize / (1024 * 1024))}MB)`);
    const sampled = await api.sampleFileByByteRanges(target.id, fileSize, 150, 60 * 1024);
    if (sampled && sampled.chunks.length > 0) {
      // Return header + all chunks as combined CSV
      const content = sampled.header + '\n' + sampled.chunks.join('\n');
      return { filename: target.name, content, modifiedTime: target.modifiedTime };
    }
  }

  // Fallback: full download
  console.log('⬇️ Byte-range sampling unavailable, trying full download...');
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
        // For actual CSVs: byte-range sampling
        if (!csv) {
          const fileSize = parseInt(file.size || '0', 10);
          if (fileSize > 500_000) {
            const sampled = await api.sampleFileByByteRanges(file.id, fileSize, maxChunksPerFile * 2, 50 * 1024);
            if (sampled && sampled.chunks.length > 0) {
              csv = sampled.header + '\n' + sampled.chunks.join('\n');
            }
          }
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
          // Files are 1+ GB — use Range tail download (header + last 8 MB per file)
          // 8 MB ≈ last 9 minutes of the day; with 10s RMS = ~54 points per file
          const fileSizeBytes = parseInt(file.size || '0', 10);
          const isLargeFile = fileSizeBytes > 5 * 1024 * 1024;
          const content = isLargeFile
            ? await api.downloadFileTailWithHeader(file.id, 8 * 1024 * 1024)
            : await api.downloadFileQuick(file.id);
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
    // Falls back to the most recent file if no exact date match found
    let targetFile = files.find(f => {
      if (!date) return true; // no date → pick first (newest)
      const nameMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (nameMatch && nameMatch[1] === date) return true;
      if (f.modifiedTime && f.modifiedTime.startsWith(date)) return true;
      return false;
    });

    if (!targetFile) {
      // No file for the requested date — use the latest file instead
      console.log(`⚠️ No file found for date ${date}, falling back to latest: ${files[0]?.name}`);
      targetFile = files[0];
    } else {
      console.log(`📅 Found file for ${date}: ${targetFile.name}`);
    }

    if (!targetFile) return null;

    // Check cache
    const cached = getCachedFile(targetFile.id, targetFile.modifiedTime);
    if (cached) {
      console.log(`⚡ Cache hit for ${targetFile.name}`);
      return { filename: targetFile.name, content: cached, modifiedTime: targetFile.modifiedTime };
    }

    // Files are 1+ GB — always use Range tail download (header + last 30 MB)
    // 30 MB @ ~15 KB/s data rate ≈ last 35 minutes of the day
    const fileSizeBytes = parseInt(targetFile.size || '0', 10);
    const isLargeFile = fileSizeBytes > 5 * 1024 * 1024; // > 5 MB
    const content = isLargeFile
      ? await api.downloadFileTailWithHeader(targetFile.id, 30 * 1024 * 1024)
      : await api.downloadFileWithAPIKey(targetFile.id, 0);
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

// ── Internal helper: pick one raw sample from each byte-range chunk ──────
function pickOneSampleFromChunks(header: string, chunks: string[], fileDate?: string): any[] {
  const h = header.split(',').map(s => s.trim().toLowerCase());
  const col = (n: string) => h.indexOf(n);
  const tsIdx = Math.max(col('timestamp'), col('time'), col('ts'));
  const axAIdx = col('ax_adxl'), ayAIdx = col('ay_adxl'), azAIdx = col('az_adxl');
  const axWIdx = col('ax_wt901'), ayWIdx = col('ay_wt901'), azWIdx = col('az_wt901');
  const acxIdx = col('accel_x') >= 0 ? col('accel_x') : col('x');
  const acyIdx = col('accel_y') >= 0 ? col('accel_y') : col('y');
  const aczIdx = col('accel_z') >= 0 ? col('accel_z') : col('z');
  const strIdx = col('stroke_mm');
  const tmpIdx = [col('temp_c'), col('temperature_c'), col('temperature')].find(i => i >= 0) ?? -1;

  const dateRef = fileDate ? new Date(fileDate) : new Date();
  const parseTs = (raw: string): number => {
    const s = raw.trim();
    if (s.match(/^\d{1,2}:\d{2}:\d{2}/)) {
      const [hh, mm, sp] = s.split(':');
      return Date.UTC(dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
        parseInt(hh), parseInt(mm), parseInt(sp || '0'));
    }
    const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const pf = (v: string[], i: number): number => {
    if (i < 0 || i >= v.length) return 0;
    const n = parseFloat(v[i]?.trim() || ''); return isNaN(n) ? 0 : n;
  };

  const result: any[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').filter(l => l.length > 5);
    if (!lines.length) continue;
    // Pick the middle line of the chunk as representative sample
    const midIdx = Math.floor(lines.length / 2);
    const v = lines[midIdx].split(',');
    if (v.length < h.length - 1) continue;
    const ts = tsIdx >= 0 ? parseTs(v[tsIdx]) : 0;
    if (!ts) continue;
    const axA = pf(v, axAIdx), ayA = pf(v, ayAIdx), azA = pf(v, azAIdx);
    const axW = pf(v, axWIdx), ayW = pf(v, ayWIdx), azW = pf(v, azWIdx);
    const acx = pf(v, acxIdx) || axA, acy = pf(v, acyIdx) || ayA, acz = pf(v, aczIdx) || azA;
    result.push({
      timestamp: ts, rawTimestamp: '',
      ax_adxl: axA, ay_adxl: ayA, az_adxl: azA,
      ax_wt901: axW, ay_wt901: ayW, az_wt901: azW,
      accel_x: acx, accel_y: acy, accel_z: acz,
      x: acx, y: acy, z: acz, vibration: acx, acceleration: acy,
      stroke_mm: pf(v, strIdx), strain: pf(v, strIdx),
      temperature_c: pf(v, tmpIdx), temperature: pf(v, tmpIdx),
    });
  }
  return result;
}

// ── Internal helper: compute one RMS point per byte-range chunk ──────────
function computeRMSFromChunks(header: string, chunks: string[], fileDate?: string): any[] {
  const h = header.split(',').map(s => s.trim().toLowerCase());
  const col = (n: string) => h.indexOf(n);
  const tsIdx = Math.max(col('timestamp'), col('time'), col('ts'));
  const axAIdx = col('ax_adxl'), ayAIdx = col('ay_adxl'), azAIdx = col('az_adxl');
  const axWIdx = col('ax_wt901'), ayWIdx = col('ay_wt901'), azWIdx = col('az_wt901');
  const acxIdx = col('accel_x') >= 0 ? col('accel_x') : col('x');
  const acyIdx = col('accel_y') >= 0 ? col('accel_y') : col('y');
  const aczIdx = col('accel_z') >= 0 ? col('accel_z') : col('z');
  const strIdx = col('stroke_mm');
  const tmpIdx = [col('temp_c'), col('temperature_c'), col('temperature')].find(i => i >= 0) ?? -1;

  const dateRef = fileDate ? new Date(fileDate) : new Date();
  const parseTs = (raw: string): number => {
    const s = raw.trim();
    if (s.match(/^\d{1,2}:\d{2}:\d{2}/)) {
      const [hh, mm, sp] = s.split(':');
      return Date.UTC(dateRef.getUTCFullYear(), dateRef.getUTCMonth(), dateRef.getUTCDate(),
        parseInt(hh), parseInt(mm), parseInt(sp || '0'));
    }
    const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const pf = (v: string[], i: number): number => {
    if (i < 0 || i >= v.length) return 0;
    const n = parseFloat(v[i]?.trim() || ''); return isNaN(n) ? 0 : n;
  };
  const rms = (a: number[]) => a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : 0;
  const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

  const result: any[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').filter(l => l.length > 5);
    if (!lines.length) continue;
    const axA: number[] = [], ayA: number[] = [], azA: number[] = [];
    const axW: number[] = [], ayW: number[] = [], azW: number[] = [];
    const acx: number[] = [], acy: number[] = [], acz: number[] = [];
    const st: number[] = [], tp: number[] = [];
    let firstTs = 0;
    for (const line of lines) {
      const v = line.split(',');
      if (v.length < h.length - 1) continue;
      const ts = tsIdx >= 0 ? parseTs(v[tsIdx]) : 0;
      if (!firstTs && ts) firstTs = ts;
      axA.push(pf(v, axAIdx)); ayA.push(pf(v, ayAIdx)); azA.push(pf(v, azAIdx));
      axW.push(pf(v, axWIdx)); ayW.push(pf(v, ayWIdx)); azW.push(pf(v, azWIdx));
      acx.push(pf(v, acxIdx) || pf(v, axAIdx));
      acy.push(pf(v, acyIdx) || pf(v, ayAIdx));
      acz.push(pf(v, aczIdx) || pf(v, azAIdx));
      st.push(pf(v, strIdx)); tp.push(pf(v, tmpIdx));
    }
    if (!firstTs) continue;
    const axR = rms(acx) || rms(axA), ayR = rms(acy) || rms(ayA), azR = rms(acz) || rms(azA);
    result.push({
      timestamp: firstTs, rawTimestamp: '',
      ax_adxl: rms(axA), ay_adxl: rms(ayA), az_adxl: rms(azA),
      ax_wt901: rms(axW), ay_wt901: rms(ayW), az_wt901: rms(azW),
      accel_x: axR, accel_y: ayR, accel_z: azR,
      x: axR, y: ayR, z: azR, vibration: axR, acceleration: ayR,
      stroke_mm: mean(st), strain: mean(st),
      temperature_c: tp.at(-1) ?? 0, temperature: tp.at(-1) ?? 0,
    });
  }
  return result;
}

/**
 * Stream a CSV file for a specific date directly to 1-second RMS data.
 * Uses Node.js streaming — never buffers the full 1+ GB file in memory.
 * Falls back to the most recent file if the requested date has no match.
 */
export async function streamCSVByDateAsRMS(
  date: string,
  customFolderId?: string,
  windowMs: number = 1000,
): Promise<{ filename: string; modifiedTime?: string; rmsData: any[]; rawRowCount: number } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    console.log('❌ streamCSVByDateAsRMS: No valid GOOGLE_DRIVE_API_KEY');
    return null;
  }
  let folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (folderId.includes('http')) { const e = extractFolderIdFromUrl(folderId); if (e) folderId = e; }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) {
    console.log('❌ streamCSVByDateAsRMS: No files found in folder', folderId);
    return null;
  }

  // Find exact date match, fall back to most recent file
  const targetFile = files.find(f => {
    if (!date) return true;
    const nm = f.name.match(/(\d{4}-\d{2}-\d{2})/);
    if (nm && nm[1] === date) return true;
    if (f.modifiedTime?.startsWith(date)) return true;
    return false;
  }) ?? files[0];

  const fileDate = targetFile.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? targetFile.modifiedTime?.split('T')[0];
  const fileMB = Math.round(parseInt(targetFile.size || '0') / (1024 * 1024));
  console.log(`📡 Streaming ${targetFile.name} (${fileMB} MB) → ${windowMs}ms RMS...`);
  const t0 = Date.now();

  const result = await api.streamAndComputeRMS(targetFile.id, windowMs, fileDate);
  if (!result) return null;

  console.log(`⏱️ Done in ${Math.round((Date.now() - t0) / 1000)}s`);
  return { filename: targetFile.name, modifiedTime: targetFile.modifiedTime, ...result };
}

/**
 * Sample evenly-spaced byte-range chunks from each of the N most recent files.
 * Returns representative RMS data from throughout each day — no full download needed.
 * Best for week view: N files × samplesPerFile points = overview of each day's pattern.
 */
export async function sampleWeekAsRMS(
  customFolderId?: string,
  numFiles: number = 7,
  samplesPerFile: number = 48,  // ~30 min intervals across 24h
): Promise<{ filenames: string[]; rmsData: any[] } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) return null;
  let folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (folderId.includes('http')) { const e = extractFolderIdFromUrl(folderId); if (e) folderId = e; }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) return null;

  const selected = files.slice(0, numFiles);
  const filenames: string[] = [];
  const allRMS: any[] = [];

  // Process files in sequence to avoid overloading the Drive API
  for (const file of selected) {
    const fileSize = parseInt(file.size || '0', 10);
    const fileDate = file.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? file.modifiedTime?.split('T')[0];

    if (fileSize > 5 * 1024 * 1024) {
      // Large file: sample evenly-spaced 500 KB chunks (fast, no full download)
      const sampled = await api.sampleFileByByteRanges(file.id, fileSize, samplesPerFile, 512 * 1024);
      if (sampled && sampled.chunks.length > 0) {
        const pts = computeRMSFromChunks(sampled.header, sampled.chunks, fileDate);
        if (pts.length > 0) {
          allRMS.push(...pts);
          filenames.push(file.name);
          console.log(`  📊 ${file.name}: ${sampled.chunks.length} chunks → ${pts.length} pts`);
        }
      }
    } else {
      // Small file: full tail download
      const content = await api.downloadFileTailWithHeader(file.id, fileSize);
      if (content && content.length > 100) {
        // Inline mini-RMS using computeRMSFromChunks with one big chunk
        const nl = content.indexOf('\n');
        if (nl > 0) {
          const header = content.substring(0, nl).trim();
          const pts = computeRMSFromChunks(header, [content.substring(nl + 1)], fileDate);
          if (pts.length > 0) { allRMS.push(...pts); filenames.push(file.name); }
        }
      }
    }
  }

  if (allRMS.length === 0) return null;
  console.log(`✅ sampleWeekAsRMS: ${allRMS.length} pts from ${filenames.length} files`);
  return { filenames, rmsData: allRMS };
}

/**
 * Stream a CSV file for a specific date and pick 1 raw sample per second.
 * No RMS — just one data point per second window. Ultra-low processing.
 * Falls back to the most recent file if the requested date has no match.
 */
export async function streamCSVByDateAsSampled(
  date: string,
  customFolderId?: string,
  windowMs: number = 1000,
): Promise<{ filename: string; modifiedTime?: string; sampledData: any[]; rawRowCount: number } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    console.log('❌ streamCSVByDateAsSampled: No valid GOOGLE_DRIVE_API_KEY');
    return null;
  }
  let folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (folderId.includes('http')) { const e = extractFolderIdFromUrl(folderId); if (e) folderId = e; }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) {
    console.log('❌ streamCSVByDateAsSampled: No files found in folder', folderId);
    return null;
  }

  const targetFile = files.find(f => {
    if (!date) return true;
    const nm = f.name.match(/(\d{4}-\d{2}-\d{2})/);
    if (nm && nm[1] === date) return true;
    if (f.modifiedTime?.startsWith(date)) return true;
    return false;
  }) ?? files[0];

  const fileDate = targetFile.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? targetFile.modifiedTime?.split('T')[0];
  const fileMB = Math.round(parseInt(targetFile.size || '0') / (1024 * 1024));
  console.log(`📡 Sampling ${targetFile.name} (${fileMB} MB) → 1 sample per ${windowMs}ms...`);
  const t0 = Date.now();

  const result = await api.streamAndPickOneSample(targetFile.id, windowMs, fileDate);
  if (!result) return null;

  console.log(`⏱️ Done in ${Math.round((Date.now() - t0) / 1000)}s`);
  return { filename: targetFile.name, modifiedTime: targetFile.modifiedTime, ...result };
}

/**
 * Sample week data: pick one raw data point from each byte-range chunk.
 * No RMS — just picks a representative row from evenly-spaced file positions.
 */
export async function sampleWeekAsSampled(
  customFolderId?: string,
  numFiles: number = 7,
  samplesPerFile: number = 48,
): Promise<{ filenames: string[]; sampledData: any[] } | null> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) return null;
  let folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (folderId.includes('http')) { const e = extractFolderIdFromUrl(folderId); if (e) folderId = e; }

  const api = new SimpleGoogleDriveAPI(folderId, apiKey);
  const files = await api.listFilesWithAPIKey();
  if (!files || files.length === 0) return null;

  const selected = files.slice(0, numFiles);
  const filenames: string[] = [];
  const allSampled: any[] = [];

  for (const file of selected) {
    const fileSize = parseInt(file.size || '0', 10);
    const fileDate = file.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? file.modifiedTime?.split('T')[0];

    if (fileSize > 5 * 1024 * 1024) {
      const sampled = await api.sampleFileByByteRanges(file.id, fileSize, samplesPerFile, 512 * 1024);
      if (sampled && sampled.chunks.length > 0) {
        const pts = pickOneSampleFromChunks(sampled.header, sampled.chunks, fileDate);
        if (pts.length > 0) {
          allSampled.push(...pts);
          filenames.push(file.name);
          console.log(`  📊 ${file.name}: ${sampled.chunks.length} chunks → ${pts.length} sample pts`);
        }
      }
    } else {
      const content = await api.downloadFileTailWithHeader(file.id, fileSize);
      if (content && content.length > 100) {
        const nl = content.indexOf('\n');
        if (nl > 0) {
          const header = content.substring(0, nl).trim();
          const pts = pickOneSampleFromChunks(header, [content.substring(nl + 1)], fileDate);
          if (pts.length > 0) { allSampled.push(...pts); filenames.push(file.name); }
        }
      }
    }
  }

  if (allSampled.length === 0) return null;
  console.log(`✅ sampleWeekAsSampled: ${allSampled.length} pts from ${filenames.length} files`);
  return { filenames, sampledData: allSampled };
}

export default SimpleGoogleDriveAPI;