# Google Drive CSV Integration Setup Guide

This guide will help you connect your Bridge Health Monitoring Dashboard to read CSV files from your Google Drive folder.

## Your Google Drive Folder
- **URL**: https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai?usp=sharing
- **Folder ID**: `17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai`

## Quick Setup (Option 1: API Key - Recommended for Public Files)

1. **Enable Google Drive API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Drive API
   - Go to "Credentials" and create an API Key

2. **Make your folder public (if needed)**
   - In Google Drive, right-click your folder
   - Select "Share" → "Anyone with the link can view"

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   GOOGLE_DRIVE_FOLDER_ID=17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
   GOOGLE_DRIVE_API_KEY=your_actual_api_key_here
   ```

4. **Test the connection**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000/latest` to see real-time data

## Advanced Setup (Option 2: OAuth for Private Files)

If your Google Drive folder is private, you'll need OAuth setup:

1. **Create OAuth Credentials**
   - In Google Cloud Console → Credentials
   - Create "OAuth 2.0 Client IDs"
   - Add your domain to authorized origins

2. **Get Access Token**
   - Use the Google OAuth playground or implement OAuth flow
   - Get a refresh token for long-term access

3. **Configure Environment Variables**
   ```env
   GOOGLE_DRIVE_FOLDER_ID=17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
   GOOGLE_DRIVE_CLIENT_ID=your_client_id
   GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
   ```

## CSV File Format Expected

Your CSV files should have headers like:
```csv
created_at,entry_id,field1,field2,field3,field4
2024-12-20T10:30:00Z,1,1.25,0.23,125.5,22.1
2024-12-20T10:30:10Z,2,1.28,0.24,126.1,22.3
```

Or with named columns:
```csv
created_at,vibration,acceleration,strain,temperature
2024-12-20T10:30:00Z,1.25,0.23,125.5,22.1
2024-12-20T10:30:10Z,1.28,0.24,126.1,22.3
```

## Features

- **Automatic Latest File Detection**: Always reads the most recently modified CSV
- **1-Minute Data Window**: Shows only the last 1 minute of data relative to current time
- **Real-time Updates**: Refreshes every 30 seconds automatically
- **Multiple Chart Types**: Vibration, Acceleration, Strain, Temperature
- **Status Monitoring**: Color-coded alerts based on threshold values

## Troubleshooting

1. **"No recent data available"**
   - Check if your CSV files contain data within the last minute
   - Verify timestamp format in CSV files
   - Check browser console for errors

2. **"Error fetching data"**
   - Verify your API key is correct
   - Check if the folder is accessible
   - Ensure Google Drive API is enabled

3. **"Using mock data"**
   - This means the system couldn't connect to Google Drive
   - Check your environment variables
   - Verify network connectivity

## Customization

You can modify the following in the code:

- **Data window**: Change `minutes` parameter in API calls
- **Refresh rate**: Modify interval in chart components
- **Threshold values**: Update warning/critical levels in chart components
- **Chart styling**: Customize colors and appearance

## Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## File Structure

- `lib/google-drive.ts` - Google Drive API integration
- `lib/csv-handler.ts` - CSV parsing and data filtering
- `app/api/csv-data/route.ts` - API endpoint for CSV data
- `app/latest/page.tsx` - Latest data dashboard page
- `components/latest-data-chart.tsx` - Real-time chart component