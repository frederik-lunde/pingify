// client/src/utils/formUtils.ts
import { FormikHelpers } from "formik";
// Assuming FormNotificationState is defined correctly elsewhere
import { FormNotificationState } from "../components/common/FormNotification"; // Adjust path if needed
import { NavigateFunction } from "react-router"; 
import { ApiError } from "../types"; // Use the defined ApiError type

/**
 * Processes an error (potentially an ApiError) and extracts relevant information for form display.
 * @param error The error object caught during form submission.
 * @returns A structured error object containing a message and potentially field-specific errors.
 */
export function handleApiFormError(error: unknown): { message: string; errors?: Record<string, string> } {
    // Default error message
    let message = "An unexpected error occurred. Please try again.";
    let fieldErrors: Record<string, string> | undefined = undefined;

    // Check if it's the ApiError structure from our client
    if (error && typeof error === 'object' && 'message' in error) {
        const apiError = error as ApiError;
        message = apiError.message || message; // Use API message if available

        // Check if the API provided specific field validation errors in the 'data' property
        if (apiError.data && typeof apiError.data === 'object') {
            // Example structure: { errors: { field1: 'message1', field2: 'message2' } }
            if ('errors' in apiError.data && typeof apiError.data.errors === 'object' && apiError.data.errors !== null) {
                 fieldErrors = apiError.data.errors as Record<string, string>;
                 // Optionally refine the main message if specific field errors exist
                 // message = "Please correct the highlighted fields.";
            }
            // Example structure: { field: 'fieldName', message: 'Specific error' } (less common for multiple errors)
             else if ('field' in apiError.data && typeof apiError.data.field === 'string' && 'message' in apiError.data && typeof apiError.data.message === 'string') {
                 fieldErrors = { [apiError.data.field]: apiError.data.message };
             }
             // If data itself has a message property
             else if ('message' in apiError.data && typeof apiError.data.message === 'string') {
                 message = apiError.data.message;
             }
        }
    }
    // Handle plain Error objects
    else if (error instanceof Error) {
        message = error.message;
    }

    return { message, errors: fieldErrors };
}


/**
 * Sets errors in Formik based on the processed API error information.
 * Sets field-specific errors and a general status message.
 * @param error The processed error object from `handleApiFormError`.
 * @param formikHelpers Formik helpers (specifically setFieldError and setStatus).
 */
export function setFormikErrors(
  error: { message: string; errors?: Record<string, string> },
  formikHelpers: Pick<FormikHelpers<any>, 'setFieldError' | 'setStatus'> // Only require needed helpers
): void {
  const { setFieldError, setStatus } = formikHelpers;

  // Set specific field errors if the API provided them
  if (error.errors) {
    Object.entries(error.errors).forEach(([field, msg]) => {
      // Ensure message is a string before setting
      if (typeof msg === 'string') {
          setFieldError(field, msg);
      } else {
           console.warn(`Received non-string error message for field ${field}:`, msg);
           setFieldError(field, 'Invalid input.'); // Fallback message
      }
    });
  }

  // Set the general error message in Formik's status
  // This is often displayed in a top-level Alert component
  setStatus({ error: error.message });
}


/**
 * Generic handler for Formik form submissions involving an async operation (like an API call).
 * Handles calling the submission function, setting loading states, processing errors,
 * showing notifications, and optionally navigating on success.
 *
 * @template T The type of the form values.
 * @param options Configuration object for the submission handler.
 */
export async function handleFormSubmit<T>({
  values,
  formikHelpers,
  submitFn,
  setNotification,
  navigate,
  redirectPath,
  redirectDelay = 1500, // Default delay before redirecting
  successMessage = "Operation successful!", // Default success message
}: {
  values: T; // Form values
  formikHelpers: FormikHelpers<T>; // Formik helpers object
  submitFn: (values: T) => Promise<any>; // The async function performing the submission
  setNotification: (notification: FormNotificationState) => void; // State setter for notifications
  navigate?: NavigateFunction; // Optional navigate function from react-router-dom
  redirectPath?: string; // Optional path to redirect to on success
  redirectDelay?: number; // Delay in ms before redirecting
  successMessage?: string; // Custom success message
}): Promise<void> {
  const { setSubmitting, resetForm, setStatus } = formikHelpers;
  setStatus({ error: null, success: null }); // Clear previous status

  try {
    // Call the provided async submission function
    await submitFn(values);

    // --- Success Handling ---
    setStatus({ success: successMessage }); // Set success status in Formik
    setNotification({ open: true, message: successMessage, severity: "success" }); // Show success snackbar

    // Handle redirection or form reset
    if (navigate && redirectPath) {
      setTimeout(() => {
        navigate(redirectPath); // Navigate after delay
      }, redirectDelay);
    } else {
      // Optionally reset form after a delay if not redirecting
      // setTimeout(() => {
      //   resetForm();
      // }, redirectDelay);
    }
     // Keep submitting true until after potential redirect timeout? Or set false earlier?
     // Setting false now allows UI to unlock sooner if no redirect.
     // setSubmitting(false); // Set submitting false on success path

  } catch (error) {
    // --- Error Handling ---
    console.error("Form submission error:", error); // Log the raw error
    const processedError = handleApiFormError(error); // Process error for form display
    setFormikErrors(processedError, formikHelpers); // Set errors in Formik state
    setNotification({ open: true, message: processedError.message, severity: "error" }); // Show error snackbar

  } finally {
    // Ensure submitting state is always reset, regardless of success or error
    setSubmitting(false);
  }
}

/**
 * Validates if a string is a plausible URL, checking basic structure.
 * Does not guarantee reachability or correctness beyond format.
 * @param url The string to validate.
 * @returns `true` if the string looks like a URL, `false` otherwise.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Basic regex: checks for optional protocol, domain name, and optional path.
  // Allows domain names without TLD for local development (e.g., http://localhost:3000)
  // Does not validate IP addresses rigorously.
  const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol (optional)
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name with TLD
    '((\\d{1,3}\\.){3}\\d{1,3})|'+ // OR ip (v4) address
    'localhost'+ // OR localhost
    ')(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path (optional)
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string (optional)
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator (optional)

  return !!pattern.test(url.trim());

  // Alternative using URL constructor (stricter, requires valid domain/protocol generally)
  /*
  try {
      // If no protocol, try adding https://
      const urlWithProto = url.includes('://') ? url : `https://${url}`;
      new URL(urlWithProto);
      return true;
  } catch (_) {
      return false;
  }
  */
}

/**
 * Ensures a URL string includes a protocol (defaults to `https://`).
 * If the URL already has `http://` or `https://`, it's returned unchanged.
 * @param url The URL string to process.
 * @returns The URL string with `https://` added if no protocol was present, or the original URL. Returns empty string if input is empty.
 */
export function ensureUrlProtocol(url: string): string {
  const trimmedUrl = url ? url.trim() : "";
  if (!trimmedUrl) return "";

  // Check if it already has http or https
  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  // Check for common incomplete protocols like //example.com
  if (trimmedUrl.startsWith('//')) {
      return `https:${trimmedUrl}`; // Assume https for protocol-relative URLs
  }

  // Default to adding https://
  return `https://${trimmedUrl}`;
}