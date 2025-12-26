import { NextRequest, NextResponse } from 'next/server';
import { DriveDirectAccess } from '../../../lib/drive-scraper';

export async function GET() {
  const folderId = '10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM';

  // helper for fetch with timeout and safe return
  async function safeFetchText(url: string, timeoutMs = 8000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res) return { ok: false, status: null, text: null, error: 'no response' }
      const txt = await res.text()
      return { ok: res.ok, status: res.status, text: txt }
    } catch (err) {
      return { ok: false, status: null, text: null, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(id)
    }
  }
  
  try {
    console.log('🔍 Debug: Testing automatic fetch...');
    
    // Test the proxy first
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    const proxyUrl = `/api/drive-proxy?url=${encodeURIComponent(folderUrl)}`;
    
    console.log('📡 Testing proxy URL:', proxyUrl);
    
    const proxyFullUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}${proxyUrl}`
    const proxyResult = await safeFetchText(proxyFullUrl, 5000)

    const proxyStatus = proxyResult.ok ? proxyResult.status : null;
    const proxyContent = proxyResult.ok ? proxyResult.text : '';
    
    if (!proxyResult.ok) {
      console.log('📡 Proxy fetch failed:', proxyResult.error)
    } else {
      console.log('📡 Proxy response status:', proxyStatus);
      console.log('📡 Proxy content length:', proxyContent ? proxyContent.length : 0);
    }
    
    // Test the DriveDirectAccess
    const driveAccess = new DriveDirectAccess(folderId);
    let result = null
    try {
      result = await driveAccess.getLatestCSV()
    } catch (e) {
      console.log('❌ DriveDirectAccess failed:', e instanceof Error ? e.message : String(e))
      result = null
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        folderUrl,
        proxyUrl,
        proxyStatus,
        proxyContentLength: proxyContent ? proxyContent.length : 0,
        proxyContentPreview: proxyContent ? proxyContent.substring(0, 500) : null,
        driveAccessResult: result ? {
          filename: result.filename,
          contentLength: result.content.length,
          contentPreview: result.content.substring(0, 200)
        } : null
      }
    });
    
  } catch (error) {
    console.error('🚫 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        folderId,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    });
  }
}