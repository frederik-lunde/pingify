// Types for registration form data
export interface RegisterFormData {
  email: string;
  name?: string;
  password: string;
  confirmPassword: string;
}

// Validation errors type
export type ValidationErrors = Record<string, string>;

export const validateRegistrationForm = (
  formData: RegisterFormData,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Email validation
  if (!formData.email?.trim()) {
    errors.email = "Email is required";
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
  }

  // Optional name validation (if provided)
  if (formData.name?.trim() && formData.name.length > 50) {
    errors.name = "Display name must be 50 characters or less";
  }

  // Password validation
  if (!formData.password?.trim()) {
    errors.password = "Password is required";
  } else if (formData.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  // Confirm password validation
  if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
};

export const prepareRegistrationData = (formData: RegisterFormData) => {
  return {
    email: formData.email.trim(),
    // Only include name if it's not empty
    ...(formData.name?.trim() && { name: formData.name.trim() }),
    password: formData.password,
  };
};
