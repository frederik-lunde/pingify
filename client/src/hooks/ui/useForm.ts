// src/hooks/ui/useForm.ts
import { useState, useCallback, ChangeEvent } from "react";

/**
 * Generic form data type
 */
export type FormData = Record<string, any>;

/**
 * Form validation function type
 */
export type Validator<T extends FormData> = (data: T) => ValidationErrors;

/**
 * Form validation errors type
 */
export type ValidationErrors = Record<string, string>;

/**
 * Form hook options
 */
export interface UseFormOptions<T extends FormData> {
  initialValues: T;
  onSubmit?: (values: T) => void | Promise<void>;
  validator?: Validator<T>;
}

/**
 * Hook for form handling with validation
 */
export function useForm<T extends FormData>({
  initialValues,
  onSubmit,
  validator,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitted(false);
  }, [initialValues]);

  // Update a single field
  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear error when field is updated
      if (errors[field as string]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
      }
    },
    [errors],
  );

  // Handle input changes
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      const fieldValue = type === "checkbox" ? checked : value;

      setFieldValue(name as keyof T, fieldValue);

      // Mark field as touched
      setTouched((prev) => ({
        ...prev,
        [name]: true,
      }));
    },
    [setFieldValue],
  );

  // Validate the form
  const validateForm = useCallback(() => {
    if (!validator) return true;

    const validationErrors = validator(values);
    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  }, [validator, values]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitted(true);

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => {
          acc[key] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      );
      setTouched(allTouched);

      // Validate form
      const isValid = validateForm();

      if (isValid && onSubmit) {
        try {
          setIsSubmitting(true);
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [validateForm, onSubmit, values],
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isSubmitted,
    handleChange,
    handleSubmit,
    setFieldValue,
    resetForm,
    validateForm,
  };
}

export default useForm;
