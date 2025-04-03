// src/components/WebsiteUrlSearch.tsx
import React, { useMemo, useCallback } from "react"; // Added useCallback
import {
  TextField,
  Autocomplete,
  CircularProgress,
  debounce, // Use debounce directly from MUI or import lodash.debounce
} from "@mui/material";
import { Website } from "../types"; // Ensure ApiError is available if needed
// Use the refactored hook
import { useWebsiteSearch } from "../hooks/api/useWebsites"; // Corrected import path
import { useField, useFormikContext } from "formik";

export interface WebsiteUrlSearchProps {
  name: string; // Field name for Formik
  label?: string;
  placeholder?: string;
  helperText?: string;
  searchLimit?: number;
  disabled?: boolean;
  // Optional callbacks if used outside Formik
  value?: string;
  onChange?: (url: string) => void;
  onSelect?: (website: Website | null) => void;
}

const WebsiteUrlSearch = ({
  name,
  label = "Website URL",
  placeholder = "https://example.com",
  helperText = "Enter full URL (e.g., https://example.com)",
  searchLimit = 10,
  disabled = false,
  value: externalValue, // Value prop if not using Formik
  onChange: externalOnChange, // onChange prop if not using Formik
  onSelect: externalOnSelect, // onSelect prop if not using Formik
}: WebsiteUrlSearchProps) => {
  // Formik integration
  const { setFieldValue, setFieldTouched } = useFormikContext() || {}; // Use Formik context if available
  const [field, meta] = useField(name); // Use field hook to get value/error/touched status

  // Determine if used within Formik
  const isFormik = !!setFieldValue;

  // Get current value and error state from Formik field or props
  const currentValue = isFormik ? field?.value : externalValue || "";
  const fieldError = isFormik && meta?.touched ? meta.error : undefined;

  // Use the website search hook (which manages its own state)
  const {
    results: options,
    loading,
    search: searchWebsites, // The function to trigger a search
  } = useWebsiteSearch(searchLimit);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        searchWebsites(searchTerm); // Call the search function from the hook
      }, 400), // Debounce time (e.g., 400ms)
    [searchWebsites] // Recreate debounce function if searchWebsites changes (should be stable)
  );

  // Handle input changes in the Autocomplete field
  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      // Update Formik field or call external onChange
      if (isFormik) {
        setFieldValue(name, newValue); // Update Formik state
      } else if (externalOnChange) {
        externalOnChange(newValue); // Call external handler
      }
      // Trigger debounced search based on the new input value
      debouncedSearch(newValue);
    },
    [isFormik, setFieldValue, name, externalOnChange, debouncedSearch]
  );

  // Handle selection of an item from the Autocomplete dropdown
  const handleSelection = useCallback(
    (
      _event: React.SyntheticEvent,
      selectedValue: string | Website | null, // Can be a string (freeSolo) or a Website object
    ) => {
      let finalUrl = "";
      let selectedWebsite: Website | null = null;

      if (typeof selectedValue === "string") {
        finalUrl = selectedValue; // User typed text or selected the typed text
      } else if (selectedValue) {
        finalUrl = selectedValue.url; // User selected a Website object
        selectedWebsite = selectedValue;
      }

      // Update Formik field or call external onChange with the URL
      if (isFormik) {
        setFieldValue(name, finalUrl);
        setFieldTouched(name, true, false); // Mark as touched after selection
      } else if (externalOnChange) {
        externalOnChange(finalUrl);
      }

      // Call external onSelect callback with the selected Website object (or null)
      if (externalOnSelect) {
        externalOnSelect(selectedWebsite);
      }
    },
    [isFormik, setFieldValue, setFieldTouched, name, externalOnChange, externalOnSelect]
  );

  // Handle blur event to auto-format URL (e.g., add https://)
   const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { // Type fix for TextField's onBlur
        if (isFormik) {
            field.onBlur(event); // Trigger Formik's default onBlur
             setFieldTouched(name, true); // Ensure field is marked touched
        }

        const url = event.target.value.trim();
        if (url && !url.match(/^https?:\/\//i)) {
            const newUrl = `https://${url}`;
             if (isFormik) {
                setFieldValue(name, newUrl);
            } else if (externalOnChange) {
                externalOnChange(newUrl);
            }
        }
    }, [isFormik, field, setFieldTouched, name, setFieldValue, externalOnChange]);


  return (
    <Autocomplete
      freeSolo // Allows typing custom values not in the options
      options={options} // Suggestions from the search hook
      filterOptions={(x) => x} // Let the hook/API handle filtering
      getOptionLabel={(option) => (typeof option === "string" ? option : option.url)}
      // Render option to display only URL but keep the object structure
      renderOption={(props, option) => (
        <li {...props} key={typeof option === 'string' ? option : option.id}>
          {typeof option === "string" ? option : option.url}
        </li>
      )}
      // Handle input value changes (triggers debounced search)
      onInputChange={handleInputChange}
      // Handle selection changes (updates form value, calls onSelect)
      onChange={handleSelection}
      // Value currently displayed in the input (controlled)
      inputValue={currentValue}
      // The value prop for Autocomplete needs careful handling for freeSolo
      // It's often simpler to control via inputValue and handle selection/input changes
      value={options.find(opt => opt.url === currentValue) || currentValue || null}
      loading={loading} // Show loading indicator from the search hook
      disabled={disabled}
      // Render the input TextField component
      renderInput={(params) => (
        <TextField
          {...params}
          name={name} // Pass name for Formik association
          label={label}
          variant="outlined"
          placeholder={placeholder}
          required // Reflect Formik schema requirement if applicable
          error={!!fieldError} // Show error state based on Formik meta
          helperText={fieldError || helperText} // Show Formik error or default helper text
          onBlur={handleBlur} // Handle URL formatting on blur
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
                {/* Optional: Icon to indicate search functionality */}
                {/* <InputAdornment position="end">
                  <Tooltip title="Search existing websites">
                    <IconButton size="small" edge="end">
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment> */}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default WebsiteUrlSearch;