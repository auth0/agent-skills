# Auth0 FastAPI Backend Setup Guide

Setup instructions for Auth0 with FastAPI backend APIs.

---

## Quick Setup

### Step 1: Install Dependencies

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install "fastapi[all]" python-jose[cryptography] python-dotenv requests
```

### Step 2: Create Auth0 API

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **APIs**
3. Click **Create API**
4. Enter:
   - **Name**: Your API name
   - **Identifier**: `https://your-api-identifier`
5. Click **Create**

### Step 3: Configure .env

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

---

## Next Steps

- Return to [main skill guide](../SKILL.md)
- See [Integration Guide](integration.md) for permissions
