import { NextResponse } from "next/server";
import { RealGoogleDriveReader } from '@/lib/real-drive-reader';
import { SimpleGoogleDriveReader, getLatestCSVSimple } from '@/lib/simple-drive-reader';
import { GoogleDriveAuthenticatedClient, getLatestCSVWithAPIKey } from '@/lib/google-drive-auth';
import { getCSVFromGoogleDrive } from '@/lib/simple-google-api';

const FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai';

export async function GET() {
  console.log('🧪 Testing ALL Google Drive folder access methods...');
  
  const results = {
    folderId: FOLDER_ID,
    folderUrl: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
    timestamp: new Date().toISOString(),
    environment: {
      hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    },
    tests: [] as any[]
  };

  // Test 1: Simple Google Drive API (NEW - most reliable)
  try {
    console.log('🚀 Testing Simple Google Drive API...');
    const simpleResult = await getCSVFromGoogleDrive();
    
    results.tests.push({
      method: 'SimpleGoogleDriveAPI',
      success: !!simpleResult,
      filename: simpleResult?.filename || null,
      contentLength: simpleResult?.content?.length || 0,
      hasExpectedFormat: simpleResult?.content?.includes('Device,Timestamp') || false,
      preview: simpleResult?.content?.substring(0, 200) || null
    });
  } catch (error: any) {
    results.tests.push({
      method: 'SimpleGoogleDriveAPI',
      success: false,
      error: error.message
    });
  }

  // Test 2: API Key Method (NEW)
  try {
    console.log('🔑 Testing API Key method...');
    const apiResult = await getLatestCSVWithAPIKey();
    
    results.tests.push({
      method: 'APIKeyMethod',
      success: !!apiResult,
      filename: apiResult?.filename || null,
      contentLength: apiResult?.content?.length || 0,
      hasExpectedFormat: apiResult?.content?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'APIKeyMethod',
      success: false,
      error: error.message
    });
  }

  // Test 3: OAuth Authenticated Client (NEW)
  try {
    console.log('🔐 Testing OAuth Authenticated Client...');
    const client = new GoogleDriveAuthenticatedClient();
    const oauthResult = await client.getLatestCSVFile();
    
    results.tests.push({
      method: 'OAuthClient',
      success: !!oauthResult,
      filename: oauthResult?.filename || null,
      contentLength: oauthResult?.content?.length || 0,
      hasExpectedFormat: oauthResult?.content?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'OAuthClient',
      success: false,
      error: error.message
    });
  }

  // Test 4: Direct Public Access Test
  try {
    console.log('🌐 Testing direct public access to folder...');
    const publicUrl = `https://drive.google.com/drive/folders/${FOLDER_ID}`;
    const response = await fetch(publicUrl);
    
    results.tests.push({
      method: 'DirectPublicAccess',
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      isPubliclyAccessible: response.ok
    });
  } catch (error: any) {
    results.tests.push({
      method: 'DirectPublicAccess',
      success: false,
      error: error.message
    });
  }

  // Test 5: Real Google Drive Reader (LEGACY)
  try {
    console.log('🎯 Testing RealGoogleDriveReader...');
    const realReader = new RealGoogleDriveReader(FOLDER_ID);
    const realResult = await realReader.getLatestRealCSV();
    
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: !!realResult,
      filename: realResult?.filename || null,
      contentLength: realResult?.content?.length || 0,
      hasExpectedFormat: realResult?.content?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: false,
      error: error.message
    });
  }

  // Test 6: Simple Google Drive Reader (LEGACY)  
  try {
    console.log('🔍 Testing SimpleGoogleDriveReader...');
    const simpleContent = await getLatestCSVSimple(FOLDER_ID);
    
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: !!simpleContent,
      contentLength: simpleContent?.length || 0,
      hasExpectedFormat: simpleContent?.includes('Device,Timestamp') || false
    });
  } catch (error: any) {
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: false,
      error: error.message
    });
  }

  // Summary
  const successfulMethods = results.tests.filter(test => test.success);
  const hasAnySuccess = successfulMethods.length > 0;
  
  console.log(`🏁 Test complete: ${successfulMethods.length}/${results.tests.length} methods successful`);
  
  return NextResponse.json({
    ...results,
    summary: {
      totalTests: results.tests.length,
      successfulTests: successfulMethods.length,
      hasWorkingMethod: hasAnySuccess,
      recommendedActions: hasAnySuccess 
        ? ['✅ At least one method works - data should be loading']
        : [
          '❌ No methods work - folder may not be publicly accessible',
          '🔑 Try: Get a Google Drive API key (5 min setup)',
          '🌐 Or: Make sure folder is shared as "Anyone with link can view"',
          '📁 Verify: Files exist in the folder with CSV extension'
        ]
    }
  });
}