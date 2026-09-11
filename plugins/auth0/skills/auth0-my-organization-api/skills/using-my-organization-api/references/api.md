# My Organization API - Management API & CLI

## Management API Endpoints

The My Organization API primarily uses existing Auth0 Management API v2 endpoints with organization scoping. There are no dedicated "my-organization" endpoints - instead, use the standard organization endpoints with proper authentication.

### Organization Management

#### Get Organization Details
```http
GET /api/v2/organizations/{id}
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `read:organizations`

**Response:**
```json
{
  "id": "org_123",
  "name": "acme-corp",
  "display_name": "Acme Corporation",
  "branding": {
    "logo_url": "https://example.com/logo.png",
    "colors": {
      "primary": "#FF0000"
    }
  },
  "metadata": {
    "mfaPolicy": "{\"enforce\": true, \"providers\": [\"otp\"]}"
  }
}
```

#### Update Organization
```http
PATCH /api/v2/organizations/{id}
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `update:organizations`

**Request Body:**
```json
{
  "display_name": "Updated Organization Name",
  "metadata": {
    "customSetting": "value"
  }
}
```

### Member Management

#### List Organization Members
```http
GET /api/v2/organizations/{id}/members
```

**Parameters:**
- `id` (path): Organization ID
- `page` (query): Page number (default: 0)
- `per_page` (query): Results per page (default: 50, max: 100)
- `include_totals` (query): Include totals in response (default: true)

**Required Scopes:** `read:organizations`

**Response:**
```json
{
  "members": [
    {
      "user_id": "auth0|123",
      "email": "user@example.com",
      "name": "John Doe",
      "picture": "https://example.com/avatar.jpg"
    }
  ],
  "total": 1,
  "start": 0,
  "limit": 50
}
```

#### Add Organization Members
```http
POST /api/v2/organizations/{id}/members
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `update:organizations`

**Request Body:**
```json
{
  "members": ["auth0|123", "auth0|456"]
}
```

#### Remove Organization Members
```http
DELETE /api/v2/organizations/{id}/members
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `update:organizations`

**Request Body:**
```json
{
  "members": ["auth0|123"]
}
```

### Invitation Management

#### Create Invitation
```http
POST /api/v2/organizations/{id}/invitations
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `create:organizations`, `read:organizations`

**Request Body:**
```json
{
  "invitee": {
    "email": "newuser@example.com"
  },
  "inviter": {
    "name": "Admin User"
  },
  "client_id": "your_client_id",
  "roles": ["role_id_1"],
  "ttl_sec": 604800
}
```

**Response:**
```json
{
  "id": "inv_123",
  "organization_id": "org_123",
  "invitee": {
    "email": "newuser@example.com"
  },
  "inviter": {
    "name": "Admin User"
  },
  "client_id": "your_client_id",
  "roles": ["role_id_1"],
  "expires_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-08T10:30:00.000Z"
}
```

#### List Invitations
```http
GET /api/v2/organizations/{id}/invitations
```

**Parameters:**
- `id` (path): Organization ID

**Required Scopes:** `read:organizations`

### Role Management

#### Get Member Roles
```http
GET /api/v2/organizations/{id}/members/{user_id}/roles
```

**Parameters:**
- `id` (path): Organization ID
- `user_id` (path): User ID

**Required Scopes:** `read:organizations`

#### Add Member Roles
```http
POST /api/v2/organizations/{id}/members/{user_id}/roles
```

**Parameters:**
- `id` (path): Organization ID
- `user_id` (path): User ID

**Required Scopes:** `update:organizations`

**Request Body:**
```json
{
  "roles": ["role_id_1", "role_id_2"]
}
```

#### Remove Member Roles
```http
DELETE /api/v2/organizations/{id}/members/{user_id}/roles
```

**Parameters:**
- `id` (path): Organization ID
- `user_id` (path): User ID

**Required Scopes:** `update:organizations`

**Request Body:**
```json
{
  "roles": ["role_id_1"]
}
```

## CLI Commands

### Organization Management

#### List Organizations
```bash
auth0 orgs list
```

**Options:**
- `--number`: Number of results to retrieve (default: 50)
- `--json`: Output results in JSON format

#### Create Organization
```bash
auth0 orgs create \
  --name "acme-corp" \
  --display-name "Acme Corporation" \
  --branding-logo-url "https://example.com/logo.png" \
  --metadata "key1=value1,key2=value2"
```

#### Show Organization Details
```bash
auth0 orgs show <org_id>
```

#### Update Organization
```bash
auth0 orgs update <org_id> \
  --display-name "New Name" \
  --metadata "updatedKey=updatedValue"
```

#### Delete Organization
```bash
auth0 orgs delete <org_id>
```

### Member Management

#### List Organization Members
```bash
auth0 orgs members list <org_id>
```

**Options:**
- `--number`: Number of results to retrieve

#### Add Members to Organization
```bash
auth0 orgs members add <org_id> \
  --user-ids "auth0|123,auth0|456"
```

#### Remove Members from Organization
```bash
auth0 orgs members remove <org_id> \
  --user-ids "auth0|123"
```

### Invitation Management

#### Create Invitation
```bash
auth0 orgs invitations create <org_id> \
  --email "user@example.com" \
  --role-ids "role_id_1" \
  --client-id "your_client_id"
```

#### List Invitations
```bash
auth0 orgs invitations list <org_id>
```

### Connection Management

#### Add Enabled Connection
```bash
auth0 orgs connections add <org_id> \
  --connection-id "con_123" \
  --assign-membership-on-login
```

#### List Enabled Connections
```bash
auth0 orgs connections list <org_id>
```

## SDK Support Matrix

| Feature | auth0-python | auth0-java | node-auth0 | auth0-react | auth0-angular | auth0-vue | auth0-spa-js |
|---------|--------------|------------|------------|-------------|---------------|-----------|--------------|
| Organization CRUD | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Member Management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invitations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Role Management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Self-Service SSO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Organization Context | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Full support
- ❌ Not applicable (client-side SDK)

## Error Codes

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Request successful, no content returned |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

### Organization-Specific Errors

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Insufficient scope, expected any of: read:organizations",
  "errorCode": "insufficient_scope"
}
```

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "The organization does not exist.",
  "errorCode": "org_not_found"
}
```

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "The user is already a member of the organization.",
  "errorCode": "user_already_member"
}
```

## Rate Limits

Rate limits vary by Auth0 plan:

| Plan | Read Operations | Write Operations |
|------|-----------------|------------------|
| Free | 4 RPS | 2 RPS |
| Developer | 10 RPS | 5 RPS |
| Developer Pro | 40 RPS | 20 RPS |
| Private Cloud | Custom | Custom |

### Organization-Specific Limits

- **Member operations**: Additional limits based on organization size
- **Invitation operations**: Rate limited to prevent abuse
- **Bulk operations**: Subject to stricter limits

## Configuration Options

### Organization Metadata Schema

```typescript
interface OrganizationMetadata {
  // Security policies
  mfaPolicy?: {
    enforce: boolean
    providers: string[]
    skipForDomains: string[]
  }

  // Session management
  sessionPolicy?: {
    maxAge: number
    idleTimeout: number
    maxConcurrentSessions: number
  }

  // Custom branding
  branding?: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
  }

  // Feature flags
  features?: {
    scimEnabled?: boolean
    advancedMfa?: boolean
    customDomains?: boolean
  }

  // Business logic
  memberLimit?: number
  defaultRole?: string
  allowedDomains?: string[]
}
```

### Client Application Configuration

```json
{
  "client_id": "your_client_id",
  "my_organization_configuration": {
    "connection_profile_id": "cp_123",
    "user_attribute_profile_id": "uap_456",
    "allowed_strategies": ["oidc", "saml"],
    "connection_deletion_behavior": "allow_if_empty",
    "user_access_authorization": "authorized",
    "client_credential_access_authorization": "denied"
  }
}
```

## Troubleshooting

### Common Issues

1. **"Insufficient scope" errors**
   - Ensure your Management API token has the required scopes
   - Check that the client application is authorized for the My Organization API

2. **"Organization not found" errors**
   - Verify the organization ID is correct
   - Ensure the organization exists and is accessible

3. **Invitation failures**
   - Check that the email domain is allowed
   - Verify the client ID is correct
   - Ensure the inviter has permission to send invitations

4. **Member limit exceeded**
   - Check your Auth0 plan limits
   - Consider upgrading your plan for more members

### Debugging Tips

- Use the Auth0 CLI with `--debug` flag for verbose output
- Check the Management API logs in the Auth0 Dashboard
- Verify organization metadata with `auth0 orgs show <org_id>`
- Test API calls with curl before implementing in code