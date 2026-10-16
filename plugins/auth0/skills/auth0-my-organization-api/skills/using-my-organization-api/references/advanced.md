# My Organization API - Advanced Use Cases

## Actions Integration

### Pre-User Registration Action
```typescript
// actions/pre-user-registration.js
exports.onExecutePreUserRegistration = async (event, api) => {
  const { user, organization } = event

  if (!organization) {
    // New user registration outside organization context
    return
  }

  // Check organization member limits
  const memberCount = await getOrganizationMemberCount(organization.id)

  if (memberCount >= organization.metadata?.memberLimit) {
    api.access.deny('Organization member limit exceeded')
    return
  }

  // Apply organization-specific user metadata
  api.user.setUserMetadata('organization_id', organization.id)
  api.user.setUserMetadata('joined_at', new Date().toISOString())

  // Set default roles based on organization policy
  const defaultRole = organization.metadata?.defaultRole || 'member'
  api.user.setUserMetadata('role', defaultRole)
}
```

### Post-Login Action for Organization Context
```typescript
// actions/post-login-organization-context.js
exports.onExecutePostLogin = async (event, api) => {
  const { user, organization, secrets } = event

  if (!organization) {
    // User logging in without organization context
    // Check if they have pending invitations
    const pendingInvitations = await getPendingInvitationsForUser(user.email, secrets)

    if (pendingInvitations.length > 0) {
      // Redirect to invitation acceptance flow
      api.redirect.sendUserTo('https://yourapp.com/accept-invitation', {
        query: {
          invitation_id: pendingInvitations[0].id,
          org_id: pendingInvitations[0].organization_id
        }
      })
      return
    }

    // No organization context and no invitations
    api.redirect.sendUserTo('https://yourapp.com/onboarding')
    return
  }

  // User has organization context
  // Ensure user metadata is up to date
  api.user.setUserMetadata('current_org_id', organization.id)
  api.user.setUserMetadata('last_login_org', organization.id)

  // Apply organization-specific security policies
  if (organization.metadata?.requireMfa) {
    // Check if user has completed MFA
    const hasMfa = user.multifactor && user.multifactor.length > 0

    if (!hasMfa) {
      api.multifactor.enable('any', { allowRememberBrowser: false })
    }
  }

  // Set organization-specific claims
  api.idToken.setCustomClaim('org_id', organization.id)
  api.idToken.setCustomClaim('org_name', organization.display_name)
  api.idToken.setCustomClaim('user_role', await getUserRoleInOrganization(user.user_id, organization.id, secrets))

  // Handle organization switching
  const requestedOrgId = api.getQueryParameter('organization')
  if (requestedOrgId && requestedOrgId !== organization.id) {
    // Validate user has access to requested organization
    const hasAccess = await userHasAccessToOrganization(user.user_id, requestedOrgId, secrets)

    if (hasAccess) {
      api.redirect.sendUserTo('https://yourapp.com/dashboard', {
        query: { org: requestedOrgId }
      })
    }
  }
}
```

### Machine-to-Machine Token Customization
```typescript
// actions/m2m-token-customization.js
exports.onExecutePostLogin = async (event, api) => {
  const { client, accessToken } = event

  // Only apply to M2M clients with organization scope
  if (client.client_id !== process.env.MY_ORG_API_CLIENT_ID) {
    return
  }

  // Add organization context to M2M tokens
  // This allows API calls to be scoped to specific organizations
  const orgId = accessToken.getCustomClaim('org_id')
  if (orgId) {
    api.accessToken.setCustomClaim('organization_id', orgId)
    api.accessToken.setCustomClaim('org_permissions', await getOrganizationPermissions(orgId))
  }
}
```

## Security Policies and Enforcement

### Advanced MFA Policies
```typescript
// lib/advancedMfaPolicy.ts
export interface AdvancedMfaPolicy {
  enforce: boolean
  providers: string[]
  skipForDomains: string[]
  adaptiveMfa: {
    enabled: boolean
    riskThreshold: 'low' | 'medium' | 'high'
    trustedNetworks: string[]
  }
  stepUpAuthentication: {
    enabled: boolean
    sensitiveOperations: string[]
    maxAge: number // seconds
  }
}

export async function evaluateMfaRequirement(
  user: any,
  organization: any,
  operation: string,
  context: {
    ipAddress: string
    userAgent: string
    location?: { country: string; city: string }
  }
): Promise<boolean> {
  const policy: AdvancedMfaPolicy = organization.metadata?.advancedMfaPolicy

  if (!policy?.enforce) {
    return false
  }

  // Check domain exemptions
  const userDomain = user.email.split('@')[1]
  if (policy.skipForDomains.includes(userDomain)) {
    return false
  }

  // Check step-up authentication
  if (policy.stepUpAuthentication?.enabled) {
    if (policy.stepUpAuthentication.sensitiveOperations.includes(operation)) {
      return true
    }

    // Check if step-up window has expired
    const lastMfaTime = user.last_mfa_verification
    if (lastMfaTime) {
      const timeSinceMfa = Date.now() - new Date(lastMfaTime).getTime()
      if (timeSinceMfa > (policy.stepUpAuthentication.maxAge * 1000)) {
        return true
      }
    }
  }

  // Check adaptive MFA
  if (policy.adaptiveMfa?.enabled) {
    const riskScore = await calculateRiskScore(context)

    const thresholds = {
      low: 30,
      medium: 60,
      high: 80
    }

    if (riskScore >= thresholds[policy.adaptiveMfa.riskThreshold]) {
      return true
    }

    // Check trusted networks
    if (policy.adaptiveMfa.trustedNetworks.some(network =>
      isIpInNetwork(context.ipAddress, network)
    )) {
      return false
    }
  }

  return false
}

async function calculateRiskScore(context: any): Promise<number> {
  let score = 0

  // Unknown location
  if (!context.location) {
    score += 40
  }

  // Unusual location
  if (context.location && !isCommonLocationForUser(context.location)) {
    score += 30
  }

  // Unknown device
  if (!isKnownUserAgent(context.userAgent)) {
    score += 20
  }

  // Non-trusted IP
  if (!isTrustedIp(context.ipAddress)) {
    score += 10
  }

  return Math.min(score, 100)
}
```

### Session Management Policies
```typescript
// lib/sessionPolicy.ts
export interface SessionPolicy {
  maxAge: number // seconds
  idleTimeout: number // seconds
  maxConcurrentSessions: number
  deviceTracking: boolean
  geographicRestrictions: {
    allowedCountries: string[]
    blockedCountries: string[]
  }
  networkRestrictions: {
    allowedIpRanges: string[]
    blockedIpRanges: string[]
  }
}

export async function validateSession(
  session: any,
  context: {
    ipAddress: string
    userAgent: string
    location?: { country: string }
  }
): Promise<{ valid: boolean; reason?: string }> {
  const orgId = session.user?.org_id

  if (!orgId) {
    return { valid: false, reason: 'No organization context' }
  }

  const policy = await getOrganizationSessionPolicy(orgId)

  // Check session age
  const sessionAge = Date.now() - session.iat * 1000
  if (sessionAge > policy.maxAge * 1000) {
    return { valid: false, reason: 'Session expired' }
  }

  // Check idle timeout
  const lastActivity = session.last_activity || session.iat * 1000
  const idleTime = Date.now() - lastActivity
  if (idleTime > policy.idleTimeout * 1000) {
    return { valid: false, reason: 'Session idle timeout' }
  }

  // Check geographic restrictions
  if (context.location) {
    if (policy.geographicRestrictions.blockedCountries.includes(context.location.country)) {
      return { valid: false, reason: 'Geographic restriction' }
    }

    if (policy.geographicRestrictions.allowedCountries.length > 0 &&
        !policy.geographicRestrictions.allowedCountries.includes(context.location.country)) {
      return { valid: false, reason: 'Geographic restriction' }
    }
  }

  // Check network restrictions
  if (!isIpAllowed(context.ipAddress, policy.networkRestrictions)) {
    return { valid: false, reason: 'Network restriction' }
  }

  // Check concurrent sessions
  if (policy.maxConcurrentSessions > 0) {
    const activeSessions = await getActiveSessionsForUser(session.user.sub, orgId)
    if (activeSessions >= policy.maxConcurrentSessions) {
      return { valid: false, reason: 'Maximum concurrent sessions exceeded' }
    }
  }

  return { valid: true }
}

function isIpAllowed(ipAddress: string, restrictions: any): boolean {
  // Check blocked ranges first
  for (const range of restrictions.blockedIpRanges) {
    if (isIpInRange(ipAddress, range)) {
      return false
    }
  }

  // If allowed ranges are specified, IP must be in one of them
  if (restrictions.allowedIpRanges.length > 0) {
    return restrictions.allowedIpRanges.some((range: string) =>
      isIpInRange(ipAddress, range)
    )
  }

  return true
}
```

## SCIM Integration

### SCIM Provisioning Setup
```typescript
// lib/scimProvisioning.ts
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export async function setupScimProvisioning(orgId: string, scimConfig: {
  endpoint: string
  token: string
  mapping: Record<string, string>
}): Promise<void> {
  // Create SCIM connection
  const connection = await management.connections.create({
    name: `scim-${orgId}`,
    strategy: 'scim',
    options: {
      scim_endpoint: scimConfig.endpoint,
      scim_token: scimConfig.token,
      mapping: scimConfig.mapping
    }
  })

  // Enable for organization
  await management.organizations.addEnabledConnection({
    id: orgId
  }, {
    connection_id: connection.id,
    assign_membership_on_login: true
  })

  // Update organization metadata
  await management.organizations.update({
    id: orgId
  }, {
    metadata: {
      scimEnabled: true,
      scimConnectionId: connection.id
    }
  })
}

export async function syncUsersFromScim(orgId: string): Promise<void> {
  const { data: org } = await management.organizations.get({ id: orgId })
  const scimConnectionId = org.metadata?.scimConnectionId

  if (!scimConnectionId) {
    throw new Error('SCIM not configured for this organization')
  }

  // Trigger SCIM sync
  await management.connections.sync({
    id: scimConnectionId
  })
}
```

## Multi-Organization Management

### Organization Switching
```typescript
// lib/organizationSwitching.ts
export async function switchUserOrganization(
  userId: string,
  newOrgId: string
): Promise<{ redirectUrl: string; token: string }> {
  // Validate user has access to the new organization
  const hasAccess = await userHasAccessToOrganization(userId, newOrgId)

  if (!hasAccess) {
    throw new Error('User does not have access to this organization')
  }

  // Generate organization-scoped token
  const token = await generateOrganizationToken(userId, newOrgId)

  // Get organization details for redirect
  const { data: org } = await management.organizations.get({ id: newOrgId })

  return {
    redirectUrl: `${process.env.APP_BASE_URL}/dashboard?org=${newOrgId}`,
    token
  }
}

export async function getUserOrganizations(userId: string): Promise<Array<{
  id: string
  name: string
  role: string
  isCurrent: boolean
}>> {
  // Get all organizations where user is a member
  const organizations = await management.organizations.getAll({
    member: userId
  })

  const userOrgs = await Promise.all(
    organizations.data.map(async (org) => {
      const { data: members } = await management.organizations.getMembers({
        id: org.id,
        include_totals: false
      })

      const member = members.find(m => m.user_id === userId)
      const roles = await management.organizations.getMemberRoles({
        id: org.id,
        user_id: userId
      })

      return {
        id: org.id,
        name: org.display_name,
        role: roles.data.length > 0 ? roles.data[0].name : 'member',
        isCurrent: org.id === getCurrentOrgFromSession()
      }
    })
  )

  return userOrgs
}
```

## Audit Logging

### Organization Activity Logging
```typescript
// lib/organizationAudit.ts
export interface AuditEvent {
  timestamp: Date
  userId: string
  organizationId: string
  action: string
  resource: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
}

export async function logOrganizationActivity(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
  const auditEvent: AuditEvent = {
    ...event,
    timestamp: new Date()
  }

  // Store in organization metadata or external audit system
  await management.organizations.update({
    id: event.organizationId
  }, {
    metadata: {
      lastActivity: auditEvent.timestamp.toISOString(),
      lastActivityBy: event.userId
    }
  })

  // Send to external audit logging service
  await sendToAuditService(auditEvent)

  // Check for suspicious activity
  await analyzeForSuspiciousActivity(auditEvent)
}

export async function getOrganizationAuditLog(
  orgId: string,
  filters: {
    userId?: string
    action?: string
    dateRange?: { start: Date; end: Date }
    limit?: number
  }
): Promise<AuditEvent[]> {
  // Query audit logs from external system
  return await queryAuditLogs(orgId, filters)
}

async function analyzeForSuspiciousActivity(event: AuditEvent): Promise<void> {
  const suspiciousPatterns = [
    // Multiple failed login attempts
    { action: 'login_failed', threshold: 5, window: 15 * 60 * 1000 }, // 5 in 15 min

    // Unusual login locations
    { action: 'login_success', checkLocation: true },

    // Privilege escalation attempts
    { action: 'role_change', checkPrivilege: true },

    // Bulk member operations
    { action: 'member_invite', threshold: 10, window: 60 * 1000 } // 10 in 1 min
  ]

  for (const pattern of suspiciousPatterns) {
    if (matchesPattern(event, pattern)) {
      await triggerSecurityAlert(event, pattern)
    }
  }
}
```

## Error Recovery and Resilience

### Circuit Breaker Pattern
```typescript
// lib/circuitBreaker.ts
export class OrganizationCircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }
}

// Usage in organization operations
const circuitBreaker = new OrganizationCircuitBreaker()

export async function safeOrganizationOperation(orgId: string, operation: string) {
  return circuitBreaker.execute(async () => {
    // Perform organization operation
    return await performOperation(orgId, operation)
  })
}
```