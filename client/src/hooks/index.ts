// src/hooks/index.ts
// Re-export all hooks for easier imports

// Common hooks
export * from './common/usePolling';

// API hooks
export * from './api/useAuth';
export * from './api/useWebsites';
export * from './api/useMonitoring';
export * from './api/useAlerts';

// Domain hooks
export * from './domain/useWebsiteData';
export * from './domain/useWebsiteDetail';
export * from './domain/useAlertData';

// UI hooks
export * from './ui/useForm';