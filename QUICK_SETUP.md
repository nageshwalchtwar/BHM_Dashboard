# Quick Google Drive API Setup

Your dashboard is now ready to use authenticated Google Drive API access! Here's what I've implemented:

## ✅ What's Already Done

1. **Multiple Authentication Methods**: The system tries 4 different ways to access your Google Drive:
   - Simple Google Drive API (most reliable)
   - OAuth 2.0 authentication
   - API key method (for public folders)
   - Direct URL fallback patterns

2. **Your Credentials Are Ready**: Your `.env.local` file already has:
   ```env
   GOOGLE_DRIVE_FOLDER_ID=17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
   GOOGLE_ACCOUNT_EMAIL=sagarkatakwar.22@stvincentngp.edu.in
   GOOGLE_ACCOUNT_PASSWORD=sagkat@6565
   ```

3. **Real Data Only**: The API refuses to show fake data and only displays your actual CSV files

## 🚀 Quick Setup Options

### Option 1: API Key Method (Easiest)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google Drive API
4. Create API Key in "Credentials"
5. Add to your `.env.local`:
   ```env
   GOOGLE_DRIVE_API_KEY=your-api-key-here
   ```

### Option 2: Make Folder Public (Simplest)
1. Open your Google Drive folder: https://drive.google.com/drive/folders/17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai
2. Right-click → "Share"
3. Change to "Anyone with the link" can view
4. The dashboard will automatically detect and use public access

### Option 3: OAuth Setup (Most Secure)
1. Follow the detailed guide in `GOOGLE_SETUP_GUIDE.md`
2. Get OAuth client ID, secret, and refresh token
3. Add to `.env.local`

## 🧪 Test Your Setup

1. Save your changes to `.env.local`
2. Restart your development server
3. Open your dashboard
4. Check browser DevTools Console for authentication logs
5. Look for messages like:
   - "✅ SUCCESS: Got real CSV data via [method]"
   - "📊 Parsed X real data points"

## 🔍 Debugging

The system provides detailed logging:
- 🚀 Simple Google Drive API attempts
- 🔑 OAuth authentication attempts  
- 🌐 Public folder access attempts
- 🔄 Direct URL fallback attempts

Check your browser's Network tab and Console for detailed error messages.

## 📊 Expected Results

Once working, your dashboard will:
- ✅ Automatically load the latest CSV from your Google Drive
- ✅ Parse your exact format: `Device,Timestamp,X,Y,Z,Stroke_mm,Temperature_C`
- ✅ Display real-time charts with your actual sensor data
- ✅ Refuse to show any fake/generated data

## 🆘 Need Help?

If you see 404 errors, it means none of the authentication methods worked. Try:
1. Option 2 (make folder public) first - it's the quickest test
2. Then Option 1 (API key) for more permanent access
3. Check the browser console for specific error messages

Your dashboard is ready - it just needs one of these authentication methods configured!