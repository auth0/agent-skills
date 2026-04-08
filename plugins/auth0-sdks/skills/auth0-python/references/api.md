# Auth0 Python SDK API Reference

## Configuration Reference

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH0_DOMAIN` | Auth0 tenant hostname (no https://) | `your-tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | Application client ID from Auth0 dashboard | `abcdef123456` |
| `AUTH0_CLIENT_SECRET` | Application client secret (NEVER expose) | `secret_key_here` |
| `AUTH0_SECRET` | Flask/Django session secret key | Output of `openssl rand -hex 32` |
| `AUTH0_CALLBACK_URL` | Authorized callback URL after login | `http://localhost:5000/callback` |

### Loading Environment Variables

```python
from dotenv import load_dotenv
import os

load_dotenv()  # Load .env file

domain = os.getenv("AUTH0_DOMAIN")
client_id = os.getenv("AUTH0_CLIENT_ID")
client_secret = os.getenv("AUTH0_CLIENT_SECRET")
```

### ManagementClient Initialization

```python
from auth0.management import ManagementClient

# v5 auto-manages tokens using Client Credentials flow
client = ManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

# Optional: Async client
from auth0.management import AsyncManagementClient

async_client = AsyncManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)
```

## Authentication API Reference

### GetToken - Fetch Access Tokens

The `GetToken` class provides methods to exchange credentials for access tokens.

#### Client Credentials Flow (Machine-to-Machine)

```python
from auth0.authentication import GetToken

token_client = GetToken(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

# Get access token for Management API
token = token_client.client_credentials(audience=f"https://{os.getenv('AUTH0_DOMAIN')}/api/v2/")
access_token = token.get("access_token")
```

#### Authorization Code Flow (Web Apps)

```python
# Handled by Authlib integration (see Full Example below)
# Token is returned in the callback route
token = auth0.authorize_access_token()
```

#### Resource Owner Password Flow (Not recommended for security reasons)

```python
token = token_client.login(
    username="user@example.com",
    password="password123",
    realm="Username-Password-Authentication",
    audience=f"https://{os.getenv('AUTH0_DOMAIN')}/api/v2/",
    scope="openid profile email"
)
```

### Database Connection - User Management

#### Sign Up

```python
from auth0.authentication import GetToken

token_client = GetToken(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

# Sign up user
user_data = token_client.signup(
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    email="newuser@example.com",
    password="SecurePassword123!",
    connection="Username-Password-Authentication",
    username="newuser"
)
```

#### Change Password

```python
token_client.change_password(
    email="user@example.com",
    password="NewPassword123!",
    connection="Username-Password-Authentication",
    client_id=os.getenv("AUTH0_CLIENT_ID")
)
```

### Social Connections - OAuth Integration

#### Authorization Redirect (handled by Authlib)

```python
from flask import redirect, url_for

@app.route("/login")
def login():
    return auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True),
        provider="google"  # or other social provider
    )
```

#### Get Authorization URL

```python
from auth0.authentication import GetToken

token_client = GetToken(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

auth_url = token_client.authorize_redirect_uri(
    redirect_uri="http://localhost:5000/callback",
    scope="openid profile email",
    audience=f"https://{os.getenv('AUTH0_DOMAIN')}/api/v2/"
)
```

### Passwordless Authentication

#### Email Link

```python
token_client.passwordless_email(
    email="user@example.com",
    send="link",  # or "code"
    client_id=os.getenv("AUTH0_CLIENT_ID")
)
```

#### SMS One-Time Code

```python
token_client.passwordless_sms(
    phone_number="+1234567890",
    client_id=os.getenv("AUTH0_CLIENT_ID")
)
```

## Management API Reference

### ManagementClient Initialization

The v5 SDK automatically manages tokens - no manual refresh needed:

```python
from auth0.management import ManagementClient

client = ManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)
```

### Key Sub-Clients

#### Users

```python
# Get all users (with pagination)
users_page = client.users.list()
users = users_page.get("users")

# Get a specific user
user = client.users.get(user_id="auth0|123456")

# Create a user
new_user = client.users.create({
    "email": "newuser@example.com",
    "user_metadata": {"plan": "premium"},
    "app_metadata": {"roles": ["admin"]},
    "connection": "Username-Password-Authentication",
    "password": "SecurePassword123!"
})

# Update a user
updated_user = client.users.update(user_id="auth0|123456", body={
    "user_metadata": {"plan": "enterprise"}
})

# Delete a user
client.users.delete(user_id="auth0|123456")

# Get user roles
roles = client.users.list_roles(user_id="auth0|123456")

# Assign roles to user
client.users.add_roles(user_id="auth0|123456", roles=[
    {"id": "role_123", "name": "admin"}
])
```

#### Clients (Applications)

```python
# List all applications
clients = client.clients.all()

# Get a specific client
app = client.clients.get(client_id="your_client_id")

# Create a client
new_app = client.clients.create({
    "name": "My App",
    "app_type": "regular_web",
    "allowed_callback_urls": ["http://localhost:5000/callback"],
    "allowed_logout_urls": ["http://localhost:5000"]
})

# Update a client
updated_app = client.clients.update(client_id="your_client_id", body={
    "name": "Updated App Name"
})
```

#### Connections

```python
# List all connections
connections = client.connections.all()

# Get a specific connection
conn = client.connections.get(id="con_123")

# Create a database connection
db_conn = client.connections.create({
    "name": "Username-Password-Authentication",
    "strategy": "auth0",
    "enabled_clients": ["your_client_id"]
})

# Update a connection
updated_conn = client.connections.update(id="con_123", body={
    "enabled_clients": ["client1", "client2"]
})
```

#### Roles

```python
# List all roles
roles = client.roles.all()

# Get a specific role
role = client.roles.get(id="role_123")

# Create a role
new_role = client.roles.create({
    "name": "admin",
    "description": "Administrator role"
})

# Update a role
updated_role = client.roles.update(id="role_123", body={
    "description": "Updated description"
})

# Get role permissions
permissions = client.roles.list_permissions(id="role_123")

# Add permissions to role
client.roles.add_permissions(id="role_123", permissions=[
    {"permission_name": "read:data", "resource_server_identifier": "api"}
])

# Remove permissions from role
client.roles.remove_permissions(id="role_123", permissions=[
    {"permission_name": "write:data", "resource_server_identifier": "api"}
])
```

#### Organizations

```python
# List all organizations
orgs = client.organizations.all()

# Get a specific organization
org = client.organizations.get(id="org_123")

# Create an organization
new_org = client.organizations.create({
    "name": "acme",
    "display_name": "ACME Corp"
})

# Add a member to an organization
client.organizations.add_members(id="org_123", members=[
    {"user_id": "auth0|123456"}
])

# Add roles to organization member
client.organizations.add_member_roles(id="org_123", user_id="auth0|123456", roles=[
    {"id": "role_123"}
])
```

### Pagination

#### Synchronous Pagination

```python
from auth0.management import ManagementClient, SyncPager

client = ManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

# Iterate through all users with pagination
pager = SyncPager(client.users.list, per_page=50)

for user in pager:
    print(f"User: {user['email']}")
```

#### Asynchronous Pagination

```python
from auth0.management import AsyncManagementClient, AsyncPager
import asyncio

async def list_all_users():
    client = AsyncManagementClient(
        domain=os.getenv("AUTH0_DOMAIN"),
        client_id=os.getenv("AUTH0_CLIENT_ID"),
        client_secret=os.getenv("AUTH0_CLIENT_SECRET")
    )
    
    pager = AsyncPager(client.users.list, per_page=50)
    
    async for user in pager:
        print(f"User: {user['email']}")

asyncio.run(list_all_users())
```

### Async Support

```python
from auth0.management import AsyncManagementClient
import asyncio

async def manage_users():
    client = AsyncManagementClient(
        domain=os.getenv("AUTH0_DOMAIN"),
        client_id=os.getenv("AUTH0_CLIENT_ID"),
        client_secret=os.getenv("AUTH0_CLIENT_SECRET")
    )
    
    # List users
    result = await client.users.list()
    users = result.get("users", [])
    
    # Get specific user
    user = await client.users.get(user_id="auth0|123456")
    
    # Update user
    updated = await client.users.update(
        user_id="auth0|123456",
        body={"user_metadata": {"plan": "pro"}}
    )
    
    return users

users = asyncio.run(manage_users())
```

## Claims Reference

### Standard OIDC Claims

These claims are available in the user's ID token and user info:

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Subject - unique user identifier |
| `name` | string | User's full name |
| `given_name` | string | User's first name |
| `family_name` | string | User's last name |
| `email` | string | User's email address |
| `email_verified` | boolean | Whether email is verified |
| `picture` | string | URL to user's profile picture |
| `locale` | string | User's preferred locale |
| `nickname` | string | User's nickname |
| `phone_number` | string | User's phone number |
| `phone_number_verified` | boolean | Whether phone is verified |
| `updated_at` | number | Last update timestamp (Unix time) |

### Auth0-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `aud` | string | Audience - the client ID this token is intended for |
| `iss` | string | Issuer - the Auth0 tenant URL |
| `iat` | number | Issued at timestamp (Unix time) |
| `exp` | number | Expiration timestamp (Unix time) |
| `permissions` | array | Array of permission names assigned to user |
| `org_id` | string | Organization ID if user belongs to an organization |
| `org_name` | string | Organization name |
| `roles` | array | Array of role names assigned to user |

### Accessing Claims in Flask

```python
from flask import session

@app.route("/profile")
def profile():
    user = session.get("user", {})
    
    email = user.get("email")
    name = user.get("name")
    picture = user.get("picture")
    roles = user.get("roles", [])
    permissions = user.get("permissions", [])
    
    return f"Email: {email}, Roles: {roles}"
```

## Complete Code Example

### Minimal Flask Application with Auth0

```python
import os
from flask import Flask, redirect, session, url_for, jsonify
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from auth0.management import ManagementClient
from auth0.management.core.api_error import ApiError
from functools import wraps

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")

# Configure OAuth with Auth0
oauth = OAuth(app)
auth0 = oauth.register(
    "auth0",
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    client_kwargs={"scope": "openid profile email"},
    server_metadata_url=f'https://{os.getenv("AUTH0_DOMAIN")}/.well-known/openid-configuration',
)

# Initialize Management API client
mgmt_client = ManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
)

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route("/")
def home():
    user = session.get("user")
    if user:
        return f"Hello {user.get('name', 'User')}! <a href='/profile'>Profile</a> | <a href='/logout'>Logout</a>"
    return f"<a href='/login'>Login</a>"

@app.route("/login")
def login():
    return auth0.authorize_redirect(redirect_uri=url_for("callback", _external=True))

@app.route("/callback")
def callback():
    token = auth0.authorize_access_token()
    session["user"] = token.get("userinfo")
    return redirect("/")

@app.route("/profile")
@login_required
def profile():
    user = session.get("user")
    return jsonify(user)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f'https://{os.getenv("AUTH0_DOMAIN")}/v2/logout?'
        f'returnTo={url_for("home", _external=True)}&'
        f'client_id={os.getenv("AUTH0_CLIENT_ID")}'
    )

@app.route("/admin/users")
@login_required
def list_users():
    """Admin route to list all users"""
    try:
        users_page = mgmt_client.users.list(per_page=10)
        users = users_page.get("users", [])
        return jsonify(users)
    except ApiError as e:
        return jsonify({"error": str(e.body)}), e.status_code

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

## Testing Checklist

Before deploying to production, verify:

- [ ] Login button redirects to Auth0 login page
- [ ] Callback URL successfully captures authorization code
- [ ] User data is stored in session after callback
- [ ] Protected routes redirect to login when not authenticated
- [ ] Logout clears session and redirects to Auth0 logout endpoint
- [ ] Logout URL is registered in Auth0 Application Settings
- [ ] Management API client successfully fetches users
- [ ] Management API client successfully creates users
- [ ] Management API client successfully updates users
- [ ] Error handling catches and logs API errors gracefully
- [ ] Session secret is set and secure
- [ ] HTTPS is used in production
- [ ] Client secret is not exposed in client-side code

### Test Script

```python
import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_auth0_connection():
    """Test Auth0 connectivity and configuration"""
    
    domain = os.getenv("AUTH0_DOMAIN")
    print(f"Testing connection to {domain}...")
    
    # Test well-known endpoint
    response = requests.get(f"https://{domain}/.well-known/openid-configuration")
    if response.status_code == 200:
        print("✓ Well-known endpoint accessible")
    else:
        print(f"✗ Well-known endpoint failed: {response.status_code}")
        return False
    
    # Test Management API
    try:
        from auth0.management import ManagementClient
        client = ManagementClient(
            domain=domain,
            client_id=os.getenv("AUTH0_CLIENT_ID"),
            client_secret=os.getenv("AUTH0_CLIENT_SECRET")
        )
        
        users = client.users.list(per_page=1)
        print(f"✓ Management API connected. Total users: {users.get('total', 0)}")
    except Exception as e:
        print(f"✗ Management API failed: {str(e)}")
        return False
    
    print("All checks passed!")
    return True

if __name__ == "__main__":
    test_auth0_connection()
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ImportError: cannot import name 'Auth0'` | Old v4 installed | Run `pip install --upgrade auth0-python` |
| `TokenValidationError` | Clock skew between local and Auth0 servers | Set `leeway` parameter in token verifier: `TokenVerifier(..., leeway=10)` |
| `401 Unauthorized` calling Management API | Access token expired | ManagementClient v5 auto-refreshes - if issue persists, check client credentials |
| `AttributeError: 'dict' object has no attribute 'model_dump'` | Using v4 patterns on v5 | In v5, responses are Pydantic models. Use `response.model_dump()` or access properties directly |
| `Callback URL mismatch error` | Callback URL not registered in Auth0 dashboard | Register exact URL in Application Settings > Allowed Callback URLs |
| `Invalid state parameter` | CSRF token mismatch (Authlib issue) | Ensure Flask session is properly configured with secure session secret |
| `CORS error when calling Management API` | CORS headers not set | Management API calls must be made from backend, never from browser |

## Security Considerations

### Secrets Management

- **Never expose client secret in client-side code**: Client secret is for backend only
- **Use .env file for local development**: Add `.env` to `.gitignore`
- **Use environment variables in production**: Deploy via CI/CD secrets, not in code
- **Rotate secrets regularly**: Change client secret in Auth0 dashboard and update deployments

### Token Security

- **Validate tokens server-side**: Don't trust client-provided tokens
- **Set secure session cookies**: Use `Secure`, `HttpOnly`, and `SameSite` flags
- **Use HTTPS in production**: Never transmit tokens over HTTP
- **Set reasonable token expiration**: ID tokens: 1-2 hours, refresh tokens: days/weeks

### CSRF Protection

- **Enable CSRF protection in Flask**: Use Flask-WTF or manually validate state parameter
- **Use SameSite cookies**: Prevents cross-site request forgery
- **Validate redirect URIs**: Only allow registered callback and logout URLs

### Authorization

- **Implement role-based access control**: Use roles and permissions for route protection
- **Validate permissions on backend**: Don't rely on client-side permission checks
- **Use organization isolation**: If multi-tenant, validate organization ID on all API calls
- **Log security events**: Track login failures, permission denials, admin actions

### Data Privacy

- **Minimize user data collection**: Request only necessary scopes
- **Hash sensitive data**: Never store passwords, use Auth0's secure password storage
- **Comply with regulations**: GDPR (user consent), CCPA (user rights), etc.
- **Regular security audits**: Check for exposed credentials, unused applications, inactive users
