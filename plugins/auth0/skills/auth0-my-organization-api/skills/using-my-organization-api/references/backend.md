# My Organization API - Backend Validation Patterns

## Organization Context Validation

### Next.js Middleware
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export async function middleware(request: Request) {
  const session = await getSession()

  if (!session?.user) {
    return NextResponse.redirect('/api/auth/login')
  }

  // Check if user has organization context
  if (!session.user.org_id) {
    return NextResponse.redirect('/onboarding')
  }

  // Validate organization exists and user is member
  try {
    const { data: org } = await management.organizations.get({
      id: session.user.org_id
    })

    const { data: members } = await management.organizations.getMembers({
      id: session.user.org_id,
      include_totals: false
    })

    const isMember = members.some(member => member.user_id === session.user.sub)

    if (!isMember) {
      return NextResponse.redirect('/onboarding')
    }

  } catch (error) {
    console.error('Organization validation failed:', error)
    return NextResponse.redirect('/onboarding')
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}
```

### Express Middleware
```typescript
// middleware/organizationAuth.js
const { ManagementClient } = require('auth0')

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET
})

const validateOrganizationAccess = async (req, res, next) => {
  try {
    const userId = req.oidc.user.sub
    const orgId = req.oidc.user.org_id

    if (!orgId) {
      return res.status(400).json({ error: 'No organization context' })
    }

    // Verify organization exists
    const { data: org } = await management.organizations.get({ id: orgId })

    // Verify user is a member
    const { data: members } = await management.organizations.getMembers({
      id: orgId,
      include_totals: false
    })

    const isMember = members.some(member => member.user_id === userId)

    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this organization' })
    }

    req.organization = org
    req.userMembership = members.find(member => member.user_id === userId)

    next()
  } catch (error) {
    console.error('Organization validation error:', error)
    res.status(500).json({ error: 'Organization validation failed' })
  }
}

module.exports = { validateOrganizationAccess }
```

## Role-Based Access Control

### Server Action Authentication Wrapper (My Organization API)
```typescript
// lib/withServerActionAuth.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server'

const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

type Role = 'admin' | 'member'

interface SessionData {
  user: {
    sub: string
    name?: string
    email?: string
    org_id?: string
    roles?: string[]
  }
}

export function withServerActionAuth<T extends any[], U extends any>(
  serverAction: (...args: [...T, session: SessionData]) => U,
  options: { role?: Role } = {}
) {
  return async function (...args: T) {
    const session = await auth0.getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (!session.user.org_id) {
      throw new Error('Organization context required')
    }

    if (options.role) {
      const userRole = getUserRole(session.user)
      if (userRole !== options.role) {
        throw new Error(`${options.role} role required`)
      }
    }

    return serverAction(...args, session)
  }
}

function getUserRole(user: SessionData['user']): Role {
  // Check if user has admin role in organization
  // This would typically query the Management API
  return user.roles?.includes('admin') ? 'admin' : 'member'
}
```

### API Route Protection
```typescript
// app/api/organization/admin-only/route.ts
import { withServerActionAuth } from '@/lib/withServerActionAuth'
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

const updateOrganizationSettings = withServerActionAuth(
  async (formData: FormData, session) => {
    const setting = formData.get('setting')
    const value = formData.get('value')

    await management.organizations.update({
      id: session.user.org_id!
    }, {
      metadata: {
        [setting]: value
      }
    })

    return { success: true }
  },
  { role: 'admin' } // Only admins can update settings
)

export async function POST(request: Request) {
  const formData = await request.formData()
  return updateOrganizationSettings(formData)
}
```

## Security Policy Enforcement

### MFA Policy Validation
```typescript
// lib/mfaPolicy.ts
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export interface MfaPolicy {
  enforce: boolean
  providers: string[]
  skipForDomains: string[]
}

export const DEFAULT_MFA_POLICY: MfaPolicy = {
  enforce: false,
  providers: [],
  skipForDomains: []
}

export async function getOrganizationMfaPolicy(orgId: string): Promise<MfaPolicy> {
  try {
    const { data: org } = await management.organizations.get({ id: orgId })
    const policy = org.metadata?.mfaPolicy

    if (policy) {
      return JSON.parse(policy)
    }
  } catch (error) {
    console.error('Failed to fetch MFA policy:', error)
  }

  return DEFAULT_MFA_POLICY
}

export async function shouldEnforceMfa(userEmail: string, orgId: string): Promise<boolean> {
  const policy = await getOrganizationMfaPolicy(orgId)

  if (!policy.enforce) {
    return false
  }

  // Check if user's domain should be skipped
  const userDomain = userEmail.split('@')[1]
  return !policy.skipForDomains.includes(userDomain)
}
```

### Session Management
```typescript
// lib/sessionValidation.ts
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export interface SessionPolicy {
  maxAge: number // in seconds
  requireMfa: boolean
  allowedIpRanges?: string[]
}

export async function validateSession(session: any): Promise<boolean> {
  const orgId = session.user?.org_id

  if (!orgId) {
    return false
  }

  try {
    const { data: org } = await management.organizations.get({ id: orgId })
    const sessionPolicy: SessionPolicy = org.metadata?.sessionPolicy || {
      maxAge: 8 * 60 * 60, // 8 hours
      requireMfa: false
    }

    // Check session age
    const sessionAge = Date.now() - session.iat * 1000
    if (sessionAge > sessionPolicy.maxAge * 1000) {
      return false
    }

    // Additional validations can be added here
    // - IP range checking
    // - Device validation
    // - Geographic restrictions

    return true
  } catch (error) {
    console.error('Session validation failed:', error)
    return false
  }
}
```

## Invitation Management

### Invitation Validation
```typescript
// lib/invitationValidation.ts
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export async function validateInvitation(invitationId: string, orgId: string): Promise<boolean> {
  try {
    const { data: invitation } = await management.organizations.getInvitation({
      id: orgId,
      invitation_id: invitationId
    })

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return false
    }

    // Check if invitation was already used
    if (invitation.accepted_at) {
      return false
    }

    return true
  } catch (error) {
    console.error('Invitation validation failed:', error)
    return false
  }
}

export async function processInvitationAcceptance(
  invitationId: string,
  orgId: string,
  userId: string
): Promise<void> {
  try {
    // Verify invitation is still valid
    const isValid = await validateInvitation(invitationId, orgId)
    if (!isValid) {
      throw new Error('Invalid or expired invitation')
    }

    // Add user to organization
    await management.organizations.addMembers({
      id: orgId
    }, {
      members: [userId]
    })

    // Mark invitation as accepted (if API supports it)
    // Note: This might need to be handled differently based on API capabilities

  } catch (error) {
    console.error('Failed to process invitation acceptance:', error)
    throw error
  }
}
```

## Domain Verification

### DNS-Based Domain Ownership
```typescript
// lib/domainVerification.ts
import { ManagementClient } from 'auth0'
import { resolveTxt } from 'dns/promises'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

const DOMAIN_VERIFICATION_RECORD_IDENTIFIER = 'auth0-domain-verification'

export async function initiateDomainVerification(orgId: string, domain: string): Promise<string> {
  // Generate verification token
  const token = crypto.randomUUID()

  // Store token in organization metadata
  await management.organizations.update({
    id: orgId
  }, {
    metadata: {
      domainVerificationToken: token,
      domainToVerify: domain
    }
  })

  return token
}

export async function verifyDomainOwnership(orgId: string, domain: string): Promise<boolean> {
  try {
    const { data: org } = await management.organizations.get({ id: orgId })
    const expectedToken = org.metadata?.domainVerificationToken

    if (!expectedToken) {
      return false
    }

    // Query DNS TXT records
    const txtRecords = await resolveTxt(domain)

    // Check if any record contains our verification token
    for (const record of txtRecords) {
      const joinedRecord = record.join('')
      if (joinedRecord.includes(`${DOMAIN_VERIFICATION_RECORD_IDENTIFIER}=${expectedToken}`)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Domain verification failed:', error)
    return false
  }
}
```

## Error Handling

### Centralized Error Handler
```typescript
// lib/organizationErrors.ts
export class OrganizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'OrganizationError'
  }
}

export const ORGANIZATION_ERRORS = {
  NOT_FOUND: new OrganizationError('Organization not found', 'ORG_NOT_FOUND', 404),
  ACCESS_DENIED: new OrganizationError('Access denied', 'ACCESS_DENIED', 403),
  INVALID_INVITATION: new OrganizationError('Invalid or expired invitation', 'INVALID_INVITATION', 400),
  MEMBER_LIMIT_EXCEEDED: new OrganizationError('Member limit exceeded', 'MEMBER_LIMIT_EXCEEDED', 400),
  DOMAIN_VERIFICATION_FAILED: new OrganizationError('Domain verification failed', 'DOMAIN_VERIFICATION_FAILED', 400)
}

export function handleOrganizationError(error: any): OrganizationError {
  // Map common errors to organization-specific errors
  if (error.statusCode === 404) {
    return ORGANIZATION_ERRORS.NOT_FOUND
  }

  if (error.message?.includes('access denied')) {
    return ORGANIZATION_ERRORS.ACCESS_DENIED
  }

  if (error.message?.includes('invitation')) {
    return ORGANIZATION_ERRORS.INVALID_INVITATION
  }

  // Default to generic error
  return new OrganizationError(
    error.message || 'An organization error occurred',
    'UNKNOWN_ERROR',
    error.statusCode || 500
  )
}
```