// Types for login form data
export interface LoginFormData {
    email: string;
    password: string;
    rememberMe: boolean;
  }
  
  // Validation errors type
  export type ValidationErrors = Record<string, string>;
  
  /**
   * Validates login form data
   * @param formData Login form data to validate
   * @returns Object containing validation errors
   */
  export const validateLoginForm = (formData: LoginFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    // Email validation
    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    // Password validation
    if (!formData.password?.trim()) {
      errors.password = 'Password is required';
    }
    
    return errors;
  };
  
  /**
   * Prepares login data for submission
   * @param formData Login form data
   * @returns Cleaned login data
   */
  export const prepareLoginData = (formData: LoginFormData) => {
    return {
      email: formData.email.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe
    };
  };