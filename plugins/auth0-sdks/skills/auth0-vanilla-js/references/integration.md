# Auth0 Vanilla JavaScript Integration Guide

Advanced patterns for integrating Auth0 into vanilla JavaScript applications.

---

## Protected Pages

Create pages that require authentication:

```javascript
// protected.js
import { getAuthState, login } from './auth.js';

export async function renderProtectedPage() {
  const { isAuthenticated, user } = getAuthState();

  if (!isAuthenticated) {
    // Redirect to login
    await login();
    return;
  }

  // Render protected content
  document.getElementById('app').innerHTML = `
    <h1>Protected Page</h1>
    <p>Welcome, ${user.name}!</p>
    <p>This content is only visible to authenticated users.</p>
  `;
}
```

### Simple Router with Protected Routes

```javascript
// router.js
import { getAuthState, login } from './auth.js';

const routes = {
  '/': renderHome,
  '/dashboard': renderDashboard,
  '/profile': renderProfile
};

const protectedRoutes = ['/dashboard', '/profile'];

export function navigate(path) {
  const { isAuthenticated } = getAuthState();

  // Check if route requires authentication
  if (protectedRoutes.includes(path) && !isAuthenticated) {
    login();
    return;
  }

  // Render route
  const renderFn = routes[path] || render404;
  renderFn();

  // Update URL
  window.history.pushState({}, '', path);
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
  navigate(window.location.pathname);
});
```

---

## Calling APIs

Make authenticated API calls:

```javascript
// api.js
import { getAccessToken } from './auth.js';

export async function callApi(endpoint, options = {}) {
  try {
    const token = await getAccessToken();

    const response = await fetch(`https://your-api.com${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}

// Usage
async function getUserData() {
  try {
    const data = await callApi('/user/profile');
    console.log(data);
  } catch (err) {
    alert('Failed to load user data');
  }
}
```

### With Audience Parameter

Update `auth.js` to include API audience:

```javascript
export async function initAuth0() {
  auth0Client = new Auth0Client({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: 'https://your-api-identifier' // Add this
    }
  });
  // ... rest of initialization
}
```

---

## Error Handling

Handle errors gracefully throughout your app:

```javascript
// error.js
export function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-notification';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fee;
    border: 1px solid #c00;
    padding: 1rem;
    border-radius: 4px;
    z-index: 1000;
  `;

  document.body.appendChild(errorDiv);

  // Auto-dismiss after 5 seconds
  setTimeout(() => errorDiv.remove(), 5000);
}

// Usage in auth.js
export async function initAuth0() {
  try {
    auth0Client = new Auth0Client({...});
    // ... initialization
  } catch (err) {
    showError(`Authentication error: ${err.message}`);
    throw err;
  }
}
```

---

## State Management

Simple state management for authentication:

```javascript
// state.js
let state = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null
};

const listeners = new Set();

export function getState() {
  return { ...state };
}

export function setState(updates) {
  state = { ...state, ...updates };
  listeners.forEach(listener => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Usage
subscribe((state) => {
  if (state.isAuthenticated) {
    renderAuthenticatedUI();
  } else {
    renderUnauthenticatedUI();
  }
});
```

---

## User Profile Display

Create a reusable profile component:

```javascript
// profile.js
export function renderUserProfile(user) {
  return `
    <div class="user-profile">
      <img src="${user.picture}" alt="${user.name}" width="48" height="48" />
      <div class="user-info">
        <h3>${user.name}</h3>
        <p>${user.email}</p>
        ${user.email_verified ? '<span class="verified">✓ Verified</span>' : ''}
      </div>
    </div>
  `;
}

// Usage in app.js
import { renderUserProfile } from './profile.js';

function updateUI() {
  const { user } = getAuthState();
  document.getElementById('profile').innerHTML = renderUserProfile(user);
}
```

---

## Loading States

Show loading indicators during authentication:

```javascript
// Loading component
function showLoading() {
  document.getElementById('app').innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

function hideLoading() {
  const loading = document.querySelector('.loading-spinner');
  if (loading) loading.remove();
}

// In app.js initialization
(async () => {
  showLoading();
  try {
    await initAuth0();
    updateUI();
  } finally {
    hideLoading();
  }
})();
```

---

## Session Management

Periodically check authentication status:

```javascript
// session.js
let sessionCheckInterval;

export function startSessionMonitoring(intervalMs = 5 * 60 * 1000) {
  sessionCheckInterval = setInterval(async () => {
    try {
      const authenticated = await auth0Client.isAuthenticated();
      if (!authenticated && getState().isAuthenticated) {
        // Session expired
        setState({ isAuthenticated: false, user: null });
        alert('Your session has expired. Please log in again.');
        await login();
      }
    } catch (err) {
      console.error('Session check failed:', err);
    }
  }, intervalMs);
}

export function stopSessionMonitoring() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
}

// Start monitoring after initialization
initAuth0().then(() => {
  if (getState().isAuthenticated) {
    startSessionMonitoring();
  }
});
```

---

## Form Integration

Handle forms with authentication:

```javascript
// form-handler.js
import { getAccessToken } from './auth.js';

export async function handleFormSubmit(event, endpoint) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);

  try {
    const token = await getAccessToken();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Form submission failed');

    return await response.json();
  } catch (err) {
    showError(err.message);
    throw err;
  }
}

// Usage
document.getElementById('myForm').addEventListener('submit', async (e) => {
  const result = await handleFormSubmit(e, '/api/submit');
  console.log('Form submitted:', result);
});
```

---

## Local Storage Caching

Cache user preferences (not tokens - SDK handles that):

```javascript
// cache.js
export function cacheUserPreferences(user) {
  const prefs = {
    userId: user.sub,
    theme: 'light',
    language: 'en'
  };
  localStorage.setItem('userPrefs', JSON.stringify(prefs));
}

export function getUserPreferences() {
  const prefs = localStorage.getItem('userPrefs');
  return prefs ? JSON.parse(prefs) : null;
}

export function clearUserPreferences() {
  localStorage.removeItem('userPrefs');
}
```

---

## Testing

### Mock Auth for Testing

```javascript
// test/auth.mock.js
export const mockAuth = {
  initAuth0: () => Promise.resolve({
    isAuthenticated: true,
    user: {
      sub: 'auth0|123',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg'
    }
  }),
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getAccessToken: () => Promise.resolve('mock-token'),
  getAuthState: () => ({
    isAuthenticated: true,
    user: {
      sub: 'auth0|123',
      name: 'Test User',
      email: 'test@example.com'
    }
  })
};
```

---

## Next Steps

- Check [API Reference](api.md) for complete SDK documentation
- See [Setup Guide](setup.md) for configuration options
- Return to [main skill guide](../SKILL.md) for overview
