import { userAuthManager } from './user-auth'

interface SystemHealthData {
  systemStatus: 'healthy' | 'warning' | 'error'
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  totalDataPoints: number
  lastDataUpdate: string
  dataStatus: 'good' | 'partial' | 'no_data'
  errorMessages: string[]
  warnings: string[]
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

// Simulated email sending (in production, use real email service)
class EmailService {
  private static instance: EmailService

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  // Get system health data
  async getSystemHealth(): Promise<SystemHealthData> {
    try {
      // Simulate fetching real system data
      const mockHealthData: SystemHealthData = {
        systemStatus: Math.random() > 0.8 ? 'warning' : 'healthy',
        totalDevices: 3,
        onlineDevices: Math.floor(Math.random() * 3) + 1,
        offlineDevices: 0,
        totalDataPoints: Math.floor(Math.random() * 1000) + 100,
        lastDataUpdate: new Date().toISOString(),
        dataStatus: Math.random() > 0.9 ? 'no_data' : Math.random() > 0.7 ? 'partial' : 'good',
        errorMessages: Math.random() > 0.8 ? ['Device connection timeout', 'Google Drive API rate limit'] : [],
        warnings: Math.random() > 0.6 ? ['High temperature detected on Device 2'] : []
      }

      mockHealthData.offlineDevices = mockHealthData.totalDevices - mockHealthData.onlineDevices

      return mockHealthData
    } catch (error) {
      return {
        systemStatus: 'error',
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        totalDataPoints: 0,
        lastDataUpdate: 'Unknown',
        dataStatus: 'no_data',
        errorMessages: ['Failed to fetch system health'],
        warnings: []
      }
    }
  }

  // Generate email template
  generateStatusEmail(healthData: SystemHealthData, timeOfDay: 'morning' | 'evening'): EmailTemplate {
    const greeting = timeOfDay === 'morning' ? 'Good Morning' : 'Good Evening'
    const systemStatusEmoji = {
      'healthy': '✅',
      'warning': '⚠️',
      'error': '❌'
    }[healthData.systemStatus]

    const dataStatusEmoji = {
      'good': '✅',
      'partial': '⚠️',
      'no_data': '❌'
    }[healthData.dataStatus]

    const subject = `${systemStatusEmoji} BHM System Status - ${timeOfDay === 'morning' ? 'Morning' : 'Evening'} Report`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
        .status-card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
        .status-good { border-left-color: #10b981; }
        .status-warning { border-left-color: #f59e0b; }
        .status-error { border-left-color: #ef4444; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-top: 5px; }
        .footer { background: #1f2937; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${systemStatusEmoji} Bridge Health Monitoring</h1>
            <p>${greeting}! Here's your system status report</p>
            <p>${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
        </div>
        
        <div class="content">
            <div class="status-card status-${healthData.systemStatus}">
                <h3>${systemStatusEmoji} Overall System Status: ${healthData.systemStatus.toUpperCase()}</h3>
                <p>Your bridge monitoring system is currently ${healthData.systemStatus === 'healthy' ? 'operating normally' : healthData.systemStatus === 'warning' ? 'experiencing minor issues' : 'experiencing critical issues'}.</p>
            </div>

            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${healthData.onlineDevices}/${healthData.totalDevices}</div>
                    <div class="metric-label">Devices Online</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${healthData.totalDataPoints}</div>
                    <div class="metric-label">Data Points Today</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${dataStatusEmoji}</div>
                    <div class="metric-label">Data Quality</div>
                </div>
            </div>

            <div class="status-card">
                <h4>📊 Data Status: ${healthData.dataStatus.toUpperCase()}</h4>
                ${healthData.dataStatus === 'good' 
                  ? '<p>✅ All sensors are providing data regularly. Data quality is excellent.</p>'
                  : healthData.dataStatus === 'partial' 
                    ? '<p>⚠️ Some sensors may have intermittent data. Overall data collection is functional.</p>'
                    : '<p>❌ No recent data received. Please check device connections and Google Drive access.</p>'
                }
                <p><strong>Last Update:</strong> ${new Date(healthData.lastDataUpdate).toLocaleString()}</p>
            </div>

            <div class="status-card">
                <h4>🔧 Device Status</h4>
                <ul>
                    <li>Total Devices Configured: ${healthData.totalDevices}</li>
                    <li>Online Devices: ${healthData.onlineDevices} ${healthData.onlineDevices === healthData.totalDevices ? '✅' : '⚠️'}</li>
                    <li>Offline Devices: ${healthData.offlineDevices} ${healthData.offlineDevices === 0 ? '✅' : '❌'}</li>
                </ul>
            </div>

            ${healthData.warnings.length > 0 ? `
            <div class="status-card status-warning">
                <h4>⚠️ Warnings</h4>
                <ul>
                    ${healthData.warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${healthData.errorMessages.length > 0 ? `
            <div class="status-card status-error">
                <h4>❌ Errors</h4>
                <ul>
                    ${healthData.errorMessages.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            <div class="status-card">
                <h4>📈 Recommendations</h4>
                <ul>
                    ${healthData.systemStatus === 'healthy' 
                      ? '<li>✅ System is operating optimally. Continue regular monitoring.</li>'
                      : healthData.systemStatus === 'warning'
                        ? '<li>⚠️ Monitor the system closely and address warnings promptly.</li><li>📧 Contact technical support if issues persist.</li>'
                        : '<li>❌ Immediate attention required. Check device connections and network access.</li><li>🔧 Review system logs for detailed error information.</li>'
                    }
                    <li>📊 Access your dashboard at any time for real-time data.</li>
                    <li>📧 Reply to this email if you need technical assistance.</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Bridge Health Monitoring System</strong></p>
            <p>Automated System Report</p>
            <p style="margin-top: 15px; font-style: italic;">Thanks,<br><strong>Nagesh</strong><br>Admin</p>
        </div>
    </div>
</body>
</html>
    `

    const text = `
${greeting}! Bridge Health Monitoring System Report

Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

=== SYSTEM STATUS ===
Overall Status: ${healthData.systemStatus.toUpperCase()} ${systemStatusEmoji}
Devices Online: ${healthData.onlineDevices}/${healthData.totalDevices}
Data Points Today: ${healthData.totalDataPoints}
Data Status: ${healthData.dataStatus.toUpperCase()} ${dataStatusEmoji}
Last Update: ${new Date(healthData.lastDataUpdate).toLocaleString()}

=== DEVICE STATUS ===
• Total Devices: ${healthData.totalDevices}
• Online: ${healthData.onlineDevices}
• Offline: ${healthData.offlineDevices}

${healthData.warnings.length > 0 ? `=== WARNINGS ===\n${healthData.warnings.map(w => `• ${w}`).join('\n')}\n\n` : ''}
${healthData.errorMessages.length > 0 ? `=== ERRORS ===\n${healthData.errorMessages.map(e => `• ${e}`).join('\n')}\n\n` : ''}
=== RECOMMENDATIONS ===
${healthData.systemStatus === 'healthy' 
  ? '• System is operating optimally'
  : healthData.systemStatus === 'warning'
    ? '• Monitor closely and address warnings\n• Contact support if issues persist'
    : '• Immediate attention required\n• Check connections and network access'
}
• Access dashboard for real-time data
• Reply to this email for technical assistance

---
Bridge Health Monitoring System
Automated System Report

Thanks,
Nagesh
Admin
    `

    return { subject, html, text }
  }

  // Send email to all users
  async sendSystemStatusToAllUsers(timeOfDay: 'morning' | 'evening'): Promise<{
    success: boolean
    sentCount: number
    failedCount: number
    message: string
  }> {
    try {
      const healthData = await this.getSystemHealth()
      const users = userAuthManager.getAllUsers()
      const emailTemplate = this.generateStatusEmail(healthData, timeOfDay)
      
      let sentCount = 0
      let failedCount = 0
      
      for (const user of users) {
        try {
          // In a real application, you would send actual emails here
          // For now, we'll simulate email sending and log the results
          console.log(`📧 Sending ${timeOfDay} status email to: ${user.email}`)
          console.log(`Subject: ${emailTemplate.subject}`)
          console.log(`Status: ${healthData.systemStatus}`)
          console.log('---')
          
          // Simulate email delivery (replace with real email service)
          await this.simulateEmailDelivery(user.email, emailTemplate)
          sentCount++
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error)
          failedCount++
        }
      }
      
      return {
        success: true,
        sentCount,
        failedCount,
        message: `Successfully sent ${sentCount} emails, ${failedCount} failed`
      }
    } catch (error) {
      console.error('Error sending system status emails:', error)
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        message: 'Failed to send system status emails'
      }
    }
  }

  // Simulate email delivery (replace with real email service like Nodemailer)
  private async simulateEmailDelivery(email: string, template: EmailTemplate): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // In production, replace this with actual email sending:
    // const transporter = nodemailer.createTransporter({
    //   service: 'gmail',
    //   auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    // })
    // await transporter.sendMail({
    //   from: process.env.EMAIL_FROM,
    //   to: email,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text
    // })
    
    // For now, just log that we would send the email
    console.log(`✅ Email would be sent to ${email}`)
  }

  // Manual trigger for testing
  async sendTestEmail(timeOfDay: 'morning' | 'evening' = 'morning') {
    return await this.sendSystemStatusToAllUsers(timeOfDay)
  }
}

export const emailService = EmailService.getInstance()
export default emailService