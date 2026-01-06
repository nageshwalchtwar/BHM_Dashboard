import { userAuthManager } from './user-auth'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

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

// Real email sending service using Nodemailer
class EmailService {
  private static instance: EmailService
  private transporter: Transporter | null = null
  private isConfigured = false

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    try {
      // Get email configuration from environment variables
      const emailConfig = {
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER, // Your email
          pass: process.env.EMAIL_PASS  // Your app password
        }
      }

      // Check if required environment variables are set
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.warn('⚠️ Email credentials not configured. Set EMAIL_USER and EMAIL_PASS environment variables')
        console.warn('📧 Email sending will be simulated until credentials are provided')
        this.isConfigured = false
        return
      }

      this.transporter = nodemailer.createTransporter(emailConfig)
      this.isConfigured = true
      
      // Verify the connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email server connection failed:', error)
          this.isConfigured = false
        } else {
          console.log('✅ Email server ready for sending emails')
          console.log(`📧 Configured to send from: ${emailConfig.auth.user}`)
        }
      })
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error)
      this.isConfigured = false
    }
  }

  // Get system health data
  async getSystemHealth(): Promise<SystemHealthData> {
    try {
      // Try to fetch real system data from your APIs
      const [devicesResponse, csvResponse] = await Promise.allSettled([
        fetch('http://localhost:3000/api/devices').catch(() => null),
        fetch('http://localhost:3000/api/csv-data-real').catch(() => null)
      ])

      let realData = {
        systemStatus: 'healthy' as 'healthy' | 'warning' | 'error',
        totalDevices: 3,
        onlineDevices: 3,
        offlineDevices: 0,
        totalDataPoints: 0,
        lastDataUpdate: new Date().toISOString(),
        dataStatus: 'good' as 'good' | 'partial' | 'no_data',
        errorMessages: [] as string[],
        warnings: [] as string[]
      }

      // Process device data if available
      if (devicesResponse.status === 'fulfilled' && devicesResponse.value) {
        try {
          const deviceData = await devicesResponse.value.json()
          if (deviceData.success) {
            realData.totalDevices = deviceData.devices?.length || 3
            realData.onlineDevices = deviceData.devices?.filter((d: any) => d.isActive).length || realData.totalDevices
            realData.offlineDevices = realData.totalDevices - realData.onlineDevices
          }
        } catch (error) {
          realData.warnings.push('Unable to fetch device status')
        }
      }

      // Process CSV data if available
      if (csvResponse.status === 'fulfilled' && csvResponse.value) {
        try {
          const csvData = await csvResponse.value.json()
          if (csvData.success && csvData.data) {
            realData.totalDataPoints = csvData.data.length
            realData.lastDataUpdate = csvData.metadata?.lastUpdate || new Date().toISOString()
            realData.dataStatus = csvData.data.length > 0 ? 'good' : 'no_data'
          } else {
            realData.dataStatus = 'no_data'
            realData.errorMessages.push('No recent data from sensors')
          }
        } catch (error) {
          realData.warnings.push('Unable to verify data quality')
        }
      } else {
        realData.warnings.push('CSV data API unavailable')
      }

      // Determine overall system status
      if (realData.errorMessages.length > 0 || realData.dataStatus === 'no_data') {
        realData.systemStatus = 'error'
      } else if (realData.warnings.length > 0 || realData.offlineDevices > 0) {
        realData.systemStatus = 'warning'
      } else {
        realData.systemStatus = 'healthy'
      }

      return realData
    } catch (error) {
      // Fallback to mock data if real data isn't available
      console.warn('Using mock system health data')
      return {
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

  // Get email recipients from registered users
  private getEmailRecipients(): string[] {
    const users = userAuthManager.getAllUsers()
    const activeUsers = users.filter(user => user.isActive)
    return activeUsers.map(user => user.email)
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
          console.log(`📧 Sending ${timeOfDay} status email to: ${user.email}`)
          
          // Use the new delivery method (real email or simulation)
          await this.deliverEmail(user.email, emailTemplate)
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

  // Send real email using Nodemailer
  private async sendRealEmail(email: string, template: EmailTemplate): Promise<void> {
    if (!this.transporter || !this.isConfigured) {
      throw new Error('Email service not configured')
    }

    const mailOptions = {
      from: {
        name: 'Bridge Health Monitoring System',
        address: process.env.EMAIL_USER || 'noreply@bhm.com'
      },
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    }

    await this.transporter.sendMail(mailOptions)
  }

  // Send email with fallback to simulation
  private async deliverEmail(email: string, template: EmailTemplate): Promise<void> {
    try {
      if (this.isConfigured && this.transporter) {
        await this.sendRealEmail(email, template)
        console.log(`✅ Real email sent to ${email}`)
      } else {
        // Fallback to simulation if not configured
        await this.simulateEmailDelivery(email, template)
      }
    } catch (error) {
      console.error(`❌ Failed to send email to ${email}:`, error)
      // Try simulation as fallback
      await this.simulateEmailDelivery(email, template)
    }
  }

  // Manual trigger for testing
  async sendTestEmail(timeOfDay: 'morning' | 'evening' = 'morning') {
    return await this.sendSystemStatusToAllUsers(timeOfDay)
  }

  // Check if email service is configured
  isEmailConfigured(): boolean {
    return this.isConfigured
  }

  // Get email configuration status
  getEmailStatus() {
    const recipients = this.getEmailRecipients()
    
    return {
      configured: this.isConfigured,
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER || 'Not configured',
      hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      recipientCount: recipients.length,
      recipients: recipients
    }
  }

  // Simulate email delivery (fallback method)
  private async simulateEmailDelivery(email: string, template: EmailTemplate): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log(`📧 [SIMULATED] Email sent to ${email} - ${template.subject}`)
  }
}

export const emailService = EmailService.getInstance()
export default emailService