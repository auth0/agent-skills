# My Organization API - Code Examples

## Next.js (auth0/nextjs-auth0)

### Installation
```bash
npm install @auth0/nextjs-auth0
```

### Organization-Scoped Authentication Setup (My Organization API)
```typescript
// lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server'

const MY_ORG_SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'read:my_org:details', 'update:my_org:details',
  'create:my_org:identity_providers', 'read:my_org:identity_providers',
  'update:my_org:identity_providers', 'delete:my_org:identity_providers'
]

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  secret: process.env.SESSION_ENCRYPTION_SECRET!,
  authorizationParameters: {
    audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
    scope: MY_ORG_SCOPES.join(' ')
  }
})
```

### Member Management
```typescript
// app/api/organization/members/route.ts
import { auth0 } from '@/lib/auth0'
import { ManagementClient } from 'auth0'

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!
})

export async function POST(request: Request) {
  const session = await auth0.getSession()

  if (!session?.user.org_id) {
    return Response.json({ error: 'No organization context' }, { status: 400 })
  }

  const { email, role } = await request.json()

  try {
    // Create invitation
    await management.organizations.createInvitation({
      id: session.user.org_id
    }, {
      invitee: { email },
      inviter: { name: session.user.name! },
      client_id: process.env.AUTH0_CLIENT_ID!,
      roles: role === 'admin' ? [process.env.ADMIN_ROLE_ID!] : []
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}
```

### SSO Provider Management
```typescript
// app/api/organization/sso/route.ts
export async function POST(request: Request) {
  const session = await auth0.getSession()
  const { provider, config } = await request.json()

  try {
    // Create SSO connection
    const connection = await management.connections.create({
      name: `${session.user.org_id}-${provider}`,
      strategy: provider,
      ...config
    })

    // Enable for organization
    await management.organizations.addEnabledConnection({
      id: session.user.org_id
    }, {
      connection_id: connection.id
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Failed to configure SSO' }, { status: 500 })
  }
}
```

## React (auth0/auth0-react)

### Installation
```bash
npm install @auth0/auth0-react
```

### Organization Context Provider (My Organization API)
```typescript
// components/OrganizationProvider.tsx
import { useAuth0 } from '@auth0/auth0-react'
import { createContext, useContext, useEffect, useState } from 'react'

const OrganizationContext = createContext(null)

export function OrganizationProvider({ children }) {
  const { user, getAccessTokenSilently } = useAuth0()
  const [organization, setOrganization] = useState(null)

  useEffect(() => {
    if (user?.org_id) {
      fetchOrganization(user.org_id)
    }
  }, [user])

  const fetchOrganization = async (orgId) => {
    try {
      const token = await getAccessTokenSilently({
        audience: `https://${process.env.REACT_APP_AUTH0_DOMAIN}/my-org/`,
        scope: 'read:my_org:details'
      })

      const response = await fetch(`/api/organization/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const org = await response.json()
      setOrganization(org)
    } catch (error) {
      console.error('Failed to fetch organization:', error)
    }
  }

  return (
    <OrganizationContext.Provider value={{ organization, fetchOrganization }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => useContext(OrganizationContext)
```

### Member Invitation Component
```typescript
// components/InviteMember.tsx
import { useAuth0 } from '@auth0/auth0-react'

export function InviteMember() {
  const { getAccessTokenSilently, user } = useAuth0()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')

  const handleInvite = async () => {
    try {
      const token = await getAccessTokenSilently({
        audience: `https://${process.env.REACT_APP_AUTH0_DOMAIN}/my-org/`,
        scope: 'create:my_org:invitations'
      })

      const response = await fetch('/api/organization/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, role })
      })

      if (response.ok) {
        alert('Invitation sent!')
        setEmail('')
      }
    } catch (error) {
      console.error('Failed to send invitation:', error)
    }
  }

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="member@example.com"
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button onClick={handleInvite}>Send Invitation</button>
    </div>
  )
}
```

## Express (auth0/express-openid-connect)

### Installation
```bash
npm install express-openid-connect
```

### Organization Middleware
```typescript
// middleware/organization.js
const { ManagementClient } = require('auth0')

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET
})

const requireOrganization = async (req, res, next) => {
  if (!req.oidc.user?.org_id) {
    return res.redirect('/onboarding')
  }

  try {
    const { data: org } = await management.organizations.get({
      id: req.oidc.user.org_id
    })
    req.organization = org
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid organization' })
  }
}

module.exports = { requireOrganization }
```

### Member Management Routes
```typescript
// routes/organization.js
const express = require('express')
const { requiresAuth } = require('express-openid-connect')
const { ManagementClient } = require('auth0')
const { requireOrganization } = require('../middleware/organization')

const router = express.Router()
const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET
})

router.use(requiresAuth())
router.use(requireOrganization)

// Get organization members
router.get('/members', async (req, res) => {
  try {
    const { data: members } = await management.organizations.getMembers({
      id: req.oidc.user.org_id
    })
    res.json(members)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

// Invite new member
router.post('/members', async (req, res) => {
  const { email, role } = req.body

  try {
    await management.organizations.createInvitation({
      id: req.oidc.user.org_id
    }, {
      invitee: { email },
      inviter: { name: req.oidc.user.name },
      client_id: process.env.AUTH0_CLIENT_ID,
      roles: role === 'admin' ? [process.env.ADMIN_ROLE_ID] : []
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invitation' })
  }
})

module.exports = router
```

## Python (auth0-python)

### Installation
```bash
pip install auth0-python
```

### Organization Management
```python
# organization_service.py
from auth0.management import Auth0
from auth0.authentication import GetToken

class OrganizationService:
    def __init__(self):
        self.auth0 = Auth0(
            domain=os.getenv('AUTH0_DOMAIN'),
            token=self._get_management_token()
        )

    def _get_management_token(self):
        get_token = GetToken(os.getenv('AUTH0_DOMAIN'))
        token = get_token.client_credentials(
            os.getenv('AUTH0_CLIENT_ID'),
            os.getenv('AUTH0_CLIENT_SECRET'),
            f'https://{os.getenv("AUTH0_DOMAIN")}/api/v2/'
        )
        return token['access_token']

    def get_organization(self, org_id):
        return self.auth0.organizations.get(org_id)

    def invite_member(self, org_id, email, role='member'):
        role_id = os.getenv('ADMIN_ROLE_ID') if role == 'admin' else None

        return self.auth0.organizations.create_invitation(org_id, {
            'invitee': {'email': email},
            'client_id': os.getenv('AUTH0_CLIENT_ID'),
            'roles': [role_id] if role_id else []
        })

    def update_member_role(self, org_id, user_id, role):
        # Remove existing roles
        current_roles = self.auth0.organizations.get_member_roles(org_id, user_id)
        if current_roles:
            self.auth0.organizations.delete_member_roles(org_id, user_id, {
                'roles': [r['id'] for r in current_roles]
            })

        # Add new role
        if role == 'admin':
            self.auth0.organizations.add_member_roles(org_id, user_id, {
                'roles': [os.getenv('ADMIN_ROLE_ID')]
            })
```

### Flask Integration
```python
# app.py
from flask import Flask, request, jsonify
from auth0.authentication import GetToken
from organization_service import OrganizationService

app = Flask(__name__)
org_service = OrganizationService()

def get_user_org_id():
    # Extract org_id from JWT token claims
    # This would typically come from auth0 validation
    return request.headers.get('X-Org-ID')

@app.route('/api/organization/members', methods=['POST'])
def invite_member():
    org_id = get_user_org_id()
    if not org_id:
        return jsonify({'error': 'No organization context'}), 400

    data = request.get_json()
    try:
        invitation = org_service.invite_member(
            org_id,
            data['email'],
            data.get('role', 'member')
        )
        return jsonify({'success': True, 'invitation': invitation})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/organization/members', methods=['GET'])
def get_members():
    org_id = get_user_org_id()
    if not org_id:
        return jsonify({'error': 'No organization context'}), 400

    try:
        members = org_service.get_organization_members(org_id)
        return jsonify(members)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## Java (auth0/auth0-java)

### Installation
```xml
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>auth0</artifactId>
    <version>2.0.0</version>
</dependency>
```

### Organization Service
```java
// OrganizationService.java
import com.auth0.client.mgmt.ManagementAPI;
import com.auth0.json.mgmt.organizations.Organization;
import com.auth0.json.mgmt.organizations.Invitations;

public class OrganizationService {
    private final ManagementAPI managementAPI;

    public OrganizationService(String domain, String clientId, String clientSecret) {
        this.managementAPI = ManagementAPI.newBuilder(domain, clientId, clientSecret).build();
    }

    public Organization getOrganization(String orgId) throws Exception {
        return managementAPI.organizations().get(orgId).execute().getBody();
    }

    public Invitations createInvitation(String orgId, String email, String role) throws Exception {
        String roleId = "admin".equals(role) ? System.getenv("ADMIN_ROLE_ID") : null;

        return managementAPI.organizations().createInvitation(orgId,
            new InvitationCreateRequest()
                .setInvitee(new Invitee().setEmail(email))
                .setClientId(System.getenv("AUTH0_CLIENT_ID"))
                .setRoles(roleId != null ? List.of(roleId) : List.of())
        ).execute().getBody();
    }

    public void updateMemberRole(String orgId, String userId, String role) throws Exception {
        // Remove existing roles
        var currentRoles = managementAPI.organizations()
            .getMemberRoles(orgId, userId).execute().getBody();

        if (!currentRoles.isEmpty()) {
            managementAPI.organizations().deleteMemberRoles(orgId, userId,
                new Roles().setRoles(currentRoles.stream()
                    .map(Role::getId).collect(Collectors.toList()))
            ).execute();
        }

        // Add new role
        if ("admin".equals(role)) {
            managementAPI.organizations().addMemberRoles(orgId, userId,
                new Roles().setRoles(List.of(System.getenv("ADMIN_ROLE_ID")))
            ).execute();
        }
    }
}
```

### Spring Boot Integration
```java
// OrganizationController.java
@RestController
@RequestMapping("/api/organization")
public class OrganizationController {

    @Autowired
    private OrganizationService organizationService;

    @GetMapping("/members")
    public ResponseEntity<?> getMembers(@RequestHeader("X-Org-ID") String orgId) {
        try {
            var members = organizationService.getOrganizationMembers(orgId);
            return ResponseEntity.ok(members);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/members")
    public ResponseEntity<?> inviteMember(
            @RequestHeader("X-Org-ID") String orgId,
            @RequestBody Map<String, String> body) {
        try {
            var invitation = organizationService.createInvitation(
                orgId,
                body.get("email"),
                body.get("role")
            );
            return ResponseEntity.ok(Map.of("success", true, "invitation", invitation));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
```