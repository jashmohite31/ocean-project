// Base URL for all API calls.
// In production (Render Static Site), set VITE_API_BASE_URL to your backend URL.
// e.g. https://oceanlense.onrender.com
// In local dev, leave unset — Vite proxy handles /api/* automatically.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default API_BASE;
