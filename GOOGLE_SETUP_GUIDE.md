# Google Drive API Setup Guide

To use your Google credentials for accessing the private Google Drive folder, we need to set up OAuth 2.0 authentication. Here are the steps:

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen (if required)
4. Choose "Web application" as application type
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://your-domain.vercel.app/api/auth/callback`

## Step 3: Get Refresh Token

Since you provided your Google account credentials (sagarkatakwar.22@stvincentngp.edu.in), we need to generate a refresh token for permanent access.

### Option A: Using OAuth 2.0 Playground
1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click gear icon (⚙️) in top-right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In "Step 1", find "Drive API v3"
6. Select "https://www.googleapis.com/auth/drive.readonly"
7. Click "Authorize APIs"
8. Sign in with sagarkatakwar.22@stvincentngp.edu.in
9. In "Step 2", click "Exchange authorization code for tokens"
10. Copy the refresh_token

### Option B: Using Google Auth Library (programmatic)
```javascript
const { OAuth2Client } = require('google-auth-library');

async function getRefreshToken() {
  const oauth2Client = new OAuth2Client(
    'YOUR_CLIENT_ID',
    'YOUR_CLIENT_SECRET',
    'http://localhost:3000/api/auth/callback'
  );

  // Generate a url that asks permissions
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  console.log('Authorize this app by visiting this url:', url);
  // After visiting URL and getting code, exchange it:
  // const {tokens} = await oauth2Client.getToken(code);
  // console.log('Refresh token:', tokens.refresh_token);
}
```

## Step 4: Update .env.local

Update your `.env.local` file with the actual credentials:

```env
# Google Drive API Configuration
GOOGLE_CLIENT_ID=your-actual-client-id
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REFRESH_TOKEN=your-actual-refresh-token

# Your Google Drive folder ID (already set)
GOOGLE_DRIVE_FOLDER_ID=17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai

# Your Google account (already set)
GOOGLE_ACCOUNT_EMAIL=sagarkatakwar.22@stvincentngp.edu.in
GOOGLE_ACCOUNT_PASSWORD=sagkat@6565

# Debug mode
DEBUG_GOOGLE_DRIVE=true
```

## Alternative: Service Account Method

If you prefer service account authentication:

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Create service account and download JSON key file
4. Share your Google Drive folder with the service account email
5. Use service account credentials instead of OAuth

## Testing the Setup

Once configured, your dashboard will automatically:
1. Authenticate with Google Drive using your credentials
2. List files in your shared folder
3. Download the latest CSV file
4. Parse and display the real sensor data

The API will try multiple authentication methods in order:
1. OAuth 2.0 with refresh token
2. API key method (for public access)
3. Fallback to direct URL patterns

## Current Status

✅ Google Drive folder ID configured: 17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
✅ User account credentials provided: sagarkatakwar.22@stvincentngp.edu.in
⏳ OAuth credentials need to be generated
⏳ Refresh token needs to be obtained

## Next Steps

1. Create Google Cloud project and enable Drive API
2. Generate OAuth 2.0 credentials
3. Get refresh token using OAuth playground
4. Update .env.local with real credentials
5. Test the API access

The dashboard is ready to use your real data as soon as the authentication is properly configured!