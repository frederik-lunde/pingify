// client/src/utils/formUtils.ts
import { FormikHelpers } from "formik";
import { FormNotificationState } from "../components/common/FormNotification";
import { NavigateFunction } from "react-router";

/**
 * Enhanced error interface for API errors
 */
export interface ApiFormError {
  message: string;
  field?: string;
  errors?: Record<string, string>;
}

/**
 * Handle API errors in a consistent way for forms
 * @param error The error object from the API
 * @returns Structured error information for the form
 */
export function handleApiError(error: unknown): ApiFormError {
  // Check if it's a standard Error object
  if (error instanceof Error) {
    return { message: error.message };
  }
  
  // Handle API response errors
  if (error && typeof error === "object") {
    const err = error as any;
    
    // Check for field-specific errors from API
    if (err.errors && typeof err.errors === "object") {
      return {
        message: err.message || "Validation failed",
        errors: err.errors,
      };
    }
    
    // Check for field-specific error
    if (err.field && err.message) {
      return {
        message: err.message,
        field: err.field,
      };
    }
    
    // Use message if available
    if (err.message && typeof err.message === "string") {
      return { message: err.message };
    }
    
    // Handle response data
    if (err.response?.data) {
      const data = err.response.data;
      
      if (typeof data === "string") {
        return { message: data };
      }
      
      if (typeof data === "object" && data.message) {
        return { 
          message: data.message,
          field: data.field,
          errors: data.errors
        };
      }
    }
  }
  
  // Default error message
  return { message: "An unexpected error occurred" };
}

/**
 * Set Formik errors from API error response
 * @param error API error response
 * @param setFieldError Formik's setFieldError function
 * @param setStatus Formik's setStatus function
 */
export function setFormikErrors(
  error: ApiFormError,
  formikHelpers: FormikHelpers<any>
): void {
  const { setFieldError, setStatus } = formikHelpers;
  
  // Set specific field errors if present
  if (error.errors) {
    Object.entries(error.errors).forEach(([field, message]) => {
      setFieldError(field, message);
    });
  }
  
  // Set a single field error if specified
  if (error.field) {
    setFieldError(error.field, error.message);
  }
  
  // Always set the status for the general error message
  setStatus({ error: error.message });
}

/**
 * Handle form submission with success notification and optional redirect
 * @param values Form values
 * @param formikHelpers Formik helpers
 * @param submitFn Function to submit the form data
 * @param setNotification Function to set the notification state
 * @param navigate React Router navigate function (optional)
 * @param redirectPath Path to redirect to after success (optional)
 * @param redirectDelay Delay before redirect in ms (optional)
 */
export async function handleFormSubmit<T>({
  values,
  formikHelpers,
  submitFn,
  setNotification,
  navigate,
  redirectPath,
  redirectDelay = 1500,
  successMessage = "Operation completed successfully",
}: {
  values: T;
  formikHelpers: FormikHelpers<T>;
  submitFn: (values: T) => Promise<any>;
  setNotification: (notification: FormNotificationState) => void;
  navigate?: NavigateFunction;
  redirectPath?: string;
  redirectDelay?: number;
  successMessage?: string;
}): Promise<void> {
  try {
    await submitFn(values);
    
    // Show success notification
    setNotification({
      open: true,
      message: successMessage,
      severity: "success",
    });
    
    // Redirect if needed
    if (navigate && redirectPath) {
      setTimeout(() => {
        navigate(redirectPath);
      }, redirectDelay);
    } else {
      // Reset form if not redirecting
      setTimeout(() => {
        formikHelpers.resetForm();
      }, redirectDelay);
    }
  } catch (error) {
    const apiError = handleApiError(error);
    
    // Set field errors in Formik
    setFormikErrors(apiError, formikHelpers);
    
    // Show error notification
    setNotification({
      open: true,
      message: apiError.message,
      severity: "error",
    });
    
    // Allow the form to be submitted again
    formikHelpers.setSubmitting(false);
  }
}

/**
 * Helper to validate URL formats
 * @param url URL string to validate
 * @returns Boolean indicating if URL is valid
 */
export function isValidUrl(url: string): boolean {
  // Allow URLs with or without protocol
  if (!url) return false;
  
  // First, check if it has a protocol
  if (url.match(/^https?:\/\//i)) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Try adding https:// and checking
  try {
    new URL(`https://${url}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Helper to ensure URL has protocol
 * @param url URL string to process
 * @returns URL with protocol added if missing
 */
export function ensureUrlProtocol(url: string): string {
  if (!url) return url;
  return url.match(/^https?:\/\//i) ? url : `https://${url}`;
}