// src/config/clientConfig.ts

// --- Helper to log issues during build/load time ---
function logConfigWarning(message: string) {
    // In development, log clearly. In production, maybe less verbose or use a dedicated logger.
    if (import.meta.env.MODE === 'development') {
      console.warn(`Client Config Warning: ${message}`);
    }
  }
  
  // --- Read Build-Time Environment Variables (Vite syntax) ---
  const API_URL_FROM_ENV = import.meta.env.VITE_API_BASE_URL;
  // Add other VITE_ variables here if needed in the future
  
  // --- Define Configuration Constants ---
  
  // API Base URL: Prioritize environment variable, fallback to a default for safety
  let resolvedApiBaseUrl = 'http://localhost:3001/api'; // Default fallback
  if (API_URL_FROM_ENV) {
    resolvedApiBaseUrl = API_URL_FROM_ENV;
  } else {
    // Only warn in development if the intended variable is missing
    if (import.meta.env.MODE === 'development') {
      logConfigWarning('VITE_API_BASE_URL environment variable is not set. Using default fallback.');
    }
    // In production, you might want to throw an error if it's absolutely required
    if (import.meta.env.MODE === 'production') {
       console.error("FATAL: VITE_API_BASE_URL was not configured for production build. Check your .env.production file.");
       // Consider throwing an error to halt execution if the app cannot function without it.
       // throw new Error("API Base URL is required for production.");
    }
  }
  export const API_BASE_URL = resolvedApiBaseUrl;
  
  // Add other exported config constants here if needed
  
  
  // --- Log the final config in development for easy debugging ---
  if (import.meta.env.MODE === 'development') {
    console.log('Client-side Config Initialized (Mode: development):', {
      API_BASE_URL: API_BASE_URL,
      // Add other config values here
    });
  }
  
