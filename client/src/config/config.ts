// src/config/clientConfig.ts
function logConfigWarning(message: string) {
    if (import.meta.env.MODE === 'development') {
      console.warn(`Client Config Warning: ${message}`);
    }
  }
  
  const API_URL_FROM_ENV = import.meta.env.VITE_API_BASE_URL;
  
  
  let resolvedApiBaseUrl = 'http://localhost:3001/api';
  if (API_URL_FROM_ENV) {
    resolvedApiBaseUrl = API_URL_FROM_ENV;
  } else {
    if (import.meta.env.MODE === 'development') {
      logConfigWarning('VITE_API_BASE_URL environment variable is not set. Using default fallback.');
    }
    if (import.meta.env.MODE === 'production') {
       console.error("FATAL: VITE_API_BASE_URL was not configured for production build. Check your .env.production file.");
       throw new Error("API Base URL is required for production.");
    }
  }
  export const API_BASE_URL = resolvedApiBaseUrl;
  
  
  
  if (import.meta.env.MODE === 'development') {
    console.log('Client-side Config Initialized (Mode: development):', {
      API_BASE_URL: API_BASE_URL,
    });
  }
  
