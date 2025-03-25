import { WebsiteCreateDTO } from '../../types';

// Define the validation errors type
export type ValidationErrors = Record<string, string>;


export const validateWebsiteForm = (formData: Partial<WebsiteCreateDTO>): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Validate website name
  if (!formData.name?.trim()) {
    errors.name = 'Website name is required';
  }

  // Validate URL
  if (!formData.url?.trim()) {
    errors.url = 'URL is required';
  } else {
    try {
      new URL(formData.url);
    } catch (e) {
      errors.url = 'Please enter a valid URL (include http:// or https://)';
    }
  }

  // Validate check interval
  if (formData.interval) {
    const interval = Number(formData.interval);
    if (isNaN(interval) || interval < 30 || interval > 86400) {
      errors.interval = 'Interval must be between 30 seconds and 1 day (86400 seconds)';
    }
  }

  // Validate alert-specific fields when alerts are enabled
  if (formData.alertEnabled) {
    // Validate alert threshold
    if (formData.alertThreshold) {
      const threshold = Number(formData.alertThreshold);
      if (isNaN(threshold) || threshold < 1 || threshold > 60000) {
        errors.alertThreshold = 'Threshold must be between 1 and 60000 milliseconds';
      }
    } else {
      errors.alertThreshold = 'Response threshold is required when alerts are enabled';
    }

    // Validate notification email
    if (!formData.notifyEmail) {
      errors.notifyEmail = 'Email is required when alerts are enabled';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.notifyEmail)) {
        errors.notifyEmail = 'Please enter a valid email address';
      }
    }
  }

  return errors;
};

/**
 * Prepares the website data for submission by cleaning and converting values
 * @param formData Partial website creation data
 * @returns Fully formed WebsiteCreateDTO
 */
export const prepareWebsiteData = (formData: Partial<WebsiteCreateDTO>): WebsiteCreateDTO => {
  return {
    name: formData.name!.trim(),
    url: formData.url!.trim(),
    interval: Number(formData.interval),
    alertEnabled: formData.alertEnabled || false,
    alertThreshold: formData.alertEnabled ? Number(formData.alertThreshold) : null,
    notifyEmail: formData.alertEnabled ? formData.notifyEmail : null,
  };
};