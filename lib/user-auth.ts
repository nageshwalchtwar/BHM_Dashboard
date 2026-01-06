interface User {
  id: string
  email: string
  name: string
  password: string // In production, this should be hashed
  role: 'user' | 'admin'
  createdAt: Date
  lastLogin?: Date
  isActive: boolean
}

interface UserSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
}

interface LoginResult {
  success: boolean
  user?: Omit<User, 'password'>
  token?: string
  error?: string
}

interface RegisterResult {
  success: boolean
  user?: Omit<User, 'password'>
  error?: string
}

// In-memory storage (in production, use a proper database)
class UserAuthManager {
  private users: User[] = []
  private sessions: UserSession[] = []
  private initialized = false

  constructor() {
    this.initializeDefaultAdmin()
  }

  private initializeDefaultAdmin() {
    if (this.initialized) return
    
    // Create default admin user
    const defaultAdmin: User = {
      id: 'admin-1',
      email: 'theccbussiness@gmail.com',
      name: 'System Administrator',
      password: 'admin123', // In production, this should be hashed
      role: 'admin',
      createdAt: new Date(),
      isActive: true
    }
    
    this.users.push(defaultAdmin)
    this.initialized = true
  }

  // Register new user
  register(email: string, name: string, password: string): RegisterResult {
    // Check if user already exists
    const existingUser = this.users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (existingUser) {
      return {
        success: false,
        error: 'User with this email already exists'
      }
    }

    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      email: email.toLowerCase(),
      name,
      password, // In production, hash this password
      role: 'user', // New users start as regular users
      createdAt: new Date(),
      isActive: true
    }

    this.users.push(newUser)

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser
    return {
      success: true,
      user: userWithoutPassword
    }
  }

  // Login user
  login(email: string, password: string): LoginResult {
    const user = this.users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      u.password === password &&
      u.isActive
    )

    if (!user) {
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }

    // Update last login
    user.lastLogin = new Date()

    // Create session token
    const token = this.generateToken()
    const session: UserSession = {
      id: `session-${Date.now()}`,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date()
    }

    this.sessions.push(session)

    // Return user without password
    const { password: _, ...userWithoutPassword } = user
    return {
      success: true,
      user: userWithoutPassword,
      token
    }
  }

  // Validate session token
  validateToken(token: string): User | null {
    const session = this.sessions.find(s => 
      s.token === token && 
      s.expiresAt > new Date()
    )

    if (!session) return null

    const user = this.users.find(u => u.id === session.userId && u.isActive)
    return user || null
  }

  // Get user by ID
  getUserById(id: string): User | null {
    return this.users.find(u => u.id === id && u.isActive) || null
  }

  // Get all users (admin only)
  getAllUsers(): Omit<User, 'password'>[] {
    return this.users
      .filter(u => u.isActive)
      .map(({ password, ...user }) => user)
  }

  // Promote user to admin
  promoteToAdmin(userId: string, adminUserId: string): boolean {
    const adminUser = this.getUserById(adminUserId)
    if (!adminUser || adminUser.role !== 'admin') {
      return false // Only admins can promote users
    }

    const user = this.getUserById(userId)
    if (!user) return false

    user.role = 'admin'
    return true
  }

  // Demote admin to user
  demoteToUser(userId: string, adminUserId: string): boolean {
    const adminUser = this.getUserById(adminUserId)
    if (!adminUser || adminUser.role !== 'admin') {
      return false // Only admins can demote users
    }

    const user = this.getUserById(userId)
    if (!user || user.id === adminUserId) return false // Can't demote self

    user.role = 'user'
    return true
  }

  // Deactivate user
  deactivateUser(userId: string, adminUserId: string): boolean {
    const adminUser = this.getUserById(adminUserId)
    if (!adminUser || adminUser.role !== 'admin') {
      return false // Only admins can deactivate users
    }

    const user = this.getUserById(userId)
    if (!user || user.id === adminUserId) return false // Can't deactivate self

    user.isActive = false
    // Remove all sessions for this user
    this.sessions = this.sessions.filter(s => s.userId !== userId)
    return true
  }

  // Logout (remove session)
  logout(token: string): boolean {
    const initialLength = this.sessions.length
    this.sessions = this.sessions.filter(s => s.token !== token)
    return this.sessions.length < initialLength
  }

  // Clean up expired sessions
  cleanupSessions(): void {
    const now = new Date()
    this.sessions = this.sessions.filter(s => s.expiresAt > now)
  }

  private generateToken(): string {
    return `bhm_${Date.now()}_${Math.random().toString(36).substring(2)}_${Math.random().toString(36).substring(2)}`
  }

  // Get user statistics
  getStats() {
    const totalUsers = this.users.filter(u => u.isActive).length
    const totalAdmins = this.users.filter(u => u.isActive && u.role === 'admin').length
    const recentLogins = this.users.filter(u => 
      u.isActive && 
      u.lastLogin && 
      u.lastLogin > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length

    return {
      totalUsers,
      totalAdmins,
      recentLogins,
      activeSessions: this.sessions.filter(s => s.expiresAt > new Date()).length
    }
  }
}

// Global instance
const userAuthManager = new UserAuthManager()

export {
  type User,
  type UserSession, 
  type LoginResult,
  type RegisterResult,
  userAuthManager
}

export default userAuthManager