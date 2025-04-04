// src/components/WebsiteUrlSearch.tsx
import React, { useMemo, useCallback } from "react";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  debounce,
  FormHelperText, // Import FormHelperText
  Box,            // Import Box for layout if needed
} from "@mui/material";
// Import SHARED types
import { Website } from "../types";
// Import hook
import { useWebsiteSearch } from "../hooks/api/useWebsites";
import { useField, useFormikContext } from "formik"; // Keep Formik hooks

// --- Define Props Interface ---
export interface WebsiteUrlSearchProps {
  name: string; // Field name for Formik - REQUIRED
  label?: string;
  placeholder?: string;
  helperText?: string; // Default helper text (shown when no error)
  searchLimit?: number;
  disabled?: boolean;
  required?: boolean; // To show the asterisk (*) on the label

  // Optional callbacks for non-Formik usage or extra actions
  value?: string;
  onChange?: (url: string) => void;
  onSelect?: (website: Website | null) => void;

  // --- Add Props for Formik Validation Display ---
  error?: boolean;       // Explicitly pass error state from Formik (meta.touched && !!meta.error)
  errorMessage?: string; // Explicitly pass error message from Formik (meta.error)
}

const WebsiteUrlSearch = ({
  name,
  label = "Website URL",
  placeholder = "https://example.com",
  helperText = "Enter full URL (e.g., https://example.com)",
  searchLimit = 10,
  disabled = false,
  required = false, // Default to false
  value: externalValue,
  onChange: externalOnChange,
  onSelect: externalOnSelect,
  // --- Destructure the new props ---
  error: externalError,
  errorMessage: externalErrorMessage,
}: WebsiteUrlSearchProps) => {

  // --- Formik Integration ---
  // Use Formik context ONLY IF available. Fallback for standalone usage.
  const formikContext = useFormikContext();
  const isFormik = !!formikContext; // Check if Formik context exists

  // Use useField hook ONLY IF inside Formik, otherwise manage state via props
  // Provide a dummy field/meta if not in Formik to avoid runtime errors
  const [field, meta] = isFormik
    ? useField(name)
    : [ { name, value: externalValue || '', onChange: () => {}, onBlur: () => {} }, // Dummy field
        { value: externalValue || '', error: externalErrorMessage, touched: false, initialValue: '', initialTouched: false, initialError: undefined }, // Dummy meta
        {}]; // Dummy helpers

  const { setFieldValue, setFieldTouched } = formikContext || {}; // Get Formik helpers if available

  // Determine final error state and message (prioritize explicit props if provided, else use Formik meta)
  const hasError = externalError ?? (isFormik && meta?.touched && !!meta.error);
  const displayMessage = hasError
    ? (externalErrorMessage ?? (isFormik ? meta.error : ''))
    : helperText; // Show error or default helper text


  // --- Search Hook & Debounce (Keep as is) ---
  const {
    results: options,
    loading,
    search: searchWebsites,
  } = useWebsiteSearch(searchLimit);

  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => { searchWebsites(searchTerm); }, 400),
    [searchWebsites]
  );

  // --- Event Handlers ---
  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      if (isFormik && setFieldValue) {
        setFieldValue(name, newValue);
      } else if (externalOnChange) {
        externalOnChange(newValue);
      }
      debouncedSearch(newValue);
    },
    [isFormik, setFieldValue, name, externalOnChange, debouncedSearch]
  );

  const handleSelection = useCallback(
    (
      _event: React.SyntheticEvent,
      selectedValue: string | Website | null,
    ) => {
      let finalUrl = "";
      let selectedWebsite: Website | null = null;

      if (typeof selectedValue === "string") {
        finalUrl = selectedValue;
      } else if (selectedValue) {
        finalUrl = selectedValue.url;
        selectedWebsite = selectedValue;
      }

      if (isFormik && setFieldValue) {
        setFieldValue(name, finalUrl);
        // Optionally mark as touched after selection
        if (setFieldTouched) setFieldTouched(name, true, false);
      } else if (externalOnChange) {
        externalOnChange(finalUrl);
      }

      if (externalOnSelect) {
        externalOnSelect(selectedWebsite);
      }
    },
    [isFormik, setFieldValue, setFieldTouched, name, externalOnChange, externalOnSelect]
  );

   // Helper to ensure URL has a protocol (needed for onBlur)
    const ensureUrlProtocol = (url: string): string => {
        if (!url) return "";
        if (!/^(https?|ftp):\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    };

    const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // *** CORRECTED: Call Formik's onBlur directly if within Formik ***
      if (isFormik) {
          field.onBlur(event); // Call Formik's handler to mark field as touched
      }
      // *** END CORRECTION ***

      // Then apply custom URL formatting logic
      const currentValue = event.target.value.trim();
      const formattedUrl = ensureUrlProtocol(currentValue);

      // Update the value only if it changed after formatting
      if (formattedUrl !== currentValue) {
           if (isFormik && setFieldValue) {
              // Update Formik state and potentially re-validate
              setFieldValue(name, formattedUrl, true);
          } else if (externalOnChange) {
              // Call external handler if not using Formik
              externalOnChange(formattedUrl);
          }
      }
  }, [isFormik, field, setFieldValue, name, externalOnChange]);


  // Determine the value to pass to Autocomplete's `value` prop
  // It should match an object in `options` if possible, or be the string value, or null
  const autocompleteValue = useMemo(() => {
      const currentFieldValue = field.value || ''; // Get value from Formik field
      const matchedOption = options.find(opt => typeof opt !== 'string' && opt.url === currentFieldValue);
      return matchedOption || currentFieldValue || null; // Prioritize matched object
  }, [field.value, options]);


  return (
    // Use Box to contain Autocomplete and custom FormHelperText
    <Box>
        <Autocomplete
            freeSolo
            options={options}
            filterOptions={(x) => x} // API handles filtering
            getOptionLabel={(option) => (typeof option === "string" ? option : option.url)}
            renderOption={(props, option) => (
                <li {...props} key={typeof option === 'string' ? option : option.id}>
                {typeof option === "string" ? option : option.url}
                </li>
            )}
            onInputChange={handleInputChange}
            onChange={handleSelection}
            // Pass the derived autocompleteValue
            value={autocompleteValue}
            // Control input value directly via field state for consistency
            inputValue={field.value || ""}
            loading={loading}
            disabled={disabled}
            // The input component rendered by Autocomplete
            renderInput={(params) => (
                <TextField
                {...params}
                // Use Formik field props for name, value (usually handled by Autocomplete), onChange (partially), onBlur
                // name={field.name} // Already passed via params spreading
                // value={field.value} // Autocomplete handles this via `value` and `inputValue` props above
                 // onChange={field.onChange} // Autocomplete handles via onInputChange/onChange
                 onBlur={handleBlur} // Use our custom blur handler
                label={label}
                variant="outlined"
                placeholder={placeholder}
                required={required} // Show required asterisk based on prop
                // --- Use derived error state ---
                error={hasError}
                // HelperText is handled outside by FormHelperText component
                // helperText={displayMessage} // DON'T set it here
                disabled={disabled}
                InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                    <>
                        {loading ? <CircularProgress color="inherit" size={20} sx={{ mr: 4 }} /> : null} {/* Adjust margin if needed */}
                        {params.InputProps.endAdornment}
                    </>
                    ),
                }}
                />
            )}
        />
        {/* Conditionally render FormHelperText outside the TextField */}
        {/* This ensures consistent spacing and allows showing default helper text */}
        {displayMessage && (
             <FormHelperText error={hasError} sx={{ marginLeft: '14px', marginRight: '14px' }}>
                 {displayMessage}
             </FormHelperText>
         )}
    </Box>
  );
};

export default WebsiteUrlSearch;