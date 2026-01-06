# Email Setup Guide

## Overview
Your BHM Dashboard now has a comprehensive email notification system that sends automated daily reports at 10am and 10pm with system status, device health, and data summaries.

## Current Status ⚠️
The email system is currently running in **simulation mode** because email credentials haven't been configured. Emails are being logged to the console but not actually sent.

## Quick Setup (Gmail - Recommended)

### Step 1: Enable App Passwords in Gmail
1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Click on "Security" in the left sidebar
3. Under "Signing in to Google", click "App passwords"
   - If you don't see this option, you need to enable 2-Factor Authentication first
4. Select "Mail" and "Other (Custom name)"
5. Enter "BHM Dashboard" as the name
6. Click "Generate" and copy the 16-character password

### Step 2: Configure Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your email credentials:
   ```env
   # Email Configuration
   EMAIL_USER=your.email@gmail.com
   EMAIL_PASS=your_16_digit_app_password
   EMAIL_SERVICE=gmail
   EMAIL_RECIPIENTS=admin@example.com,nagesh@example.com
   ```

### Step 3: Test Email Delivery
1. Restart your development server:
   ```bash
   pnpm dev
   ```

2. Visit `/email-reports` in your dashboard
3. Check the "Email Configuration" status - should show "Configured ✅"
4. Click "Send Test Email" to verify delivery

## Alternative Email Services

### Outlook/Hotmail
```env
EMAIL_SERVICE=outlook
EMAIL_USER=your.email@outlook.com
EMAIL_PASS=your_password_or_app_password
```

### Yahoo Mail
```env
EMAIL_SERVICE=yahoo
EMAIL_USER=your.email@yahoo.com
EMAIL_PASS=your_app_password
```

### Custom SMTP
```env
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your.email@yourprovider.com
EMAIL_PASS=your_password
```

## Email Features

### Automated Schedules
- **Morning Report (10:00 AM)**: System health, overnight data summary
- **Evening Report (10:00 PM)**: Full day summary, device status

### Manual Controls
- Send test emails
- Trigger reports manually
- Enable/disable automated scheduling
- View email history and status

### Email Content
Each email includes:
- System health status with device counts
- Data point statistics
- Recent alerts and warnings
- Charts showing latest sensor readings
- Professional signature: "Thanks, Nagesh, Admin"

## Troubleshooting

### Common Issues

1. **"Authentication failed" error**
   - Make sure you're using an App Password, not your regular Gmail password
   - Verify EMAIL_USER matches the Gmail account that generated the App Password

2. **"Connection refused" error**
   - Check your internet connection
   - Verify EMAIL_SERVICE is set correctly
   - For corporate networks, check firewall settings

3. **Emails going to spam**
   - Add the sender email to your contacts
   - Check spam/junk folder initially
   - Consider using a business email domain

4. **Environment variables not loading**
   - Ensure `.env.local` is in the project root directory
   - Restart the development server after making changes
   - Check for typos in variable names (case-sensitive)

### Debug Steps
1. Visit `/email-reports` to see configuration status
2. Check browser console for error messages
3. Look at server logs for SMTP errors
4. Use "Send Test Email" feature to isolate issues

## Security Notes
- Never commit `.env.local` to version control
- Use App Passwords instead of regular passwords
- Consider using environment-specific email accounts for production
- Regularly rotate App Passwords for security

## Production Deployment
When deploying to Railway or other platforms:
1. Set environment variables in your deployment platform
2. Use different EMAIL_RECIPIENTS for different environments
3. Consider using a dedicated email service like SendGrid for high volume

---

**Need Help?** Visit the `/email-reports` page in your dashboard for real-time configuration status and testing tools.