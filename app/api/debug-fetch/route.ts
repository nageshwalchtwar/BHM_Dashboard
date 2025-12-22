import { NextRequest, NextResponse } from 'next/server';
import { DriveDirectAccess } from '../../../lib/drive-scraper';

export async function GET() {
  const folderId = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';
  
  try {
    console.log('🔍 Debug: Testing automatic fetch...');
    
    // Test the proxy first
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    const proxyUrl = `/api/drive-proxy?url=${encodeURIComponent(folderUrl)}`;
    
    console.log('📡 Testing proxy URL:', proxyUrl);
    
    const proxyResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}${proxyUrl}`);
    const proxyStatus = proxyResponse.status;
    const proxyContent = await proxyResponse.text();
    
    console.log('📡 Proxy response status:', proxyStatus);
    console.log('📡 Proxy content length:', proxyContent.length);
    
    // Test the DriveDirectAccess
    const driveAccess = new DriveDirectAccess(folderId);
    const result = await driveAccess.getLatestCSV();
    
    return NextResponse.json({
      success: true,
      debug: {
        folderUrl,
        proxyUrl,
        proxyStatus,
        proxyContentLength: proxyContent.length,
        proxyContentPreview: proxyContent.substring(0, 500),
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