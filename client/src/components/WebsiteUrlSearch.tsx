// client/src/components/WebsiteUrlSearch.tsx
import React, { useState, useEffect } from "react";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  InputAdornment,
  Tooltip,
  IconButton,
  Box,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import { Website } from "../types";
import { useWebsiteSearch } from "../hooks"; // Import from the hooks directory
import { debounce } from "lodash";
import { useField, useFormikContext } from "formik";

export interface WebsiteUrlSearchProps {
  name: string; // Field name for Formik
  value?: string;
  onChange?: (url: string) => void;
  onSelect?: (website: Website | null) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  searchLimit?: number;
  disabled?: boolean;
}

const WebsiteUrlSearch = ({
  name,
  value: externalValue,
  onChange: externalOnChange,
  onSelect,
  error: externalError,
  label = "Website URL",
  placeholder = "https://example.com",
  helperText = "Full URL including http:// or https://",
  searchLimit = 10,
  disabled = false,
}: WebsiteUrlSearchProps) => {
  const [field, meta, helpers] = useField(name);
  const { setFieldValue, setFieldTouched } = useFormikContext();
  
  // Use values from Formik or from props if used outside of Formik
  const fieldValue = field?.value !== undefined ? field.value : externalValue || "";
  const fieldError = meta?.touched && meta?.error ? meta.error : externalError;
  
  // Use our search hook
  const {
    results: options,
    loading,
    search: searchWebsites,
  } = useWebsiteSearch("", searchLimit);

  // Sync input value with parent value prop or Formik field
  const [inputValue, setInputValue] = useState(fieldValue || "");

  // Update inputValue when value prop or field value changes
  useEffect(() => {
    if (fieldValue !== inputValue) {
      setInputValue(fieldValue || "");
    }
  }, [fieldValue, inputValue]);

  // Create debounced search function
  const debouncedSearch = React.useMemo(
    () =>
      debounce((searchTerm: string) => {
        searchWebsites(searchTerm);
      }, 300),
    [searchWebsites],
  );

  // Load initial options on mount
  useEffect(() => {
    debouncedSearch("");

    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle URL input change - Update parent state while typing
  const handleInputChange = (
    _event: React.SyntheticEvent,
    newInputValue: string,
  ) => {
    setInputValue(newInputValue);
    
    // Update Formik field if within Formik context, otherwise use external handler
    if (setFieldValue) {
      setFieldValue(name, newInputValue);
      setFieldTouched(name, true, false);
    } else if (externalOnChange) {
      externalOnChange(newInputValue);
    }
    
    debouncedSearch(newInputValue);
  };

  // Handle URL autocomplete selection
  const handleUrlSelect = (
    _event: React.SyntheticEvent<Element, Event>,
    newValue: string | Website | null,
    _reason: string,
  ) => {
    if (typeof newValue === "string") {
      // For string input, update field value
      if (setFieldValue) {
        setFieldValue(name, newValue);
      } else if (externalOnChange) {
        externalOnChange(newValue);
      }
      
      if (onSelect) onSelect(null);
    } else if (newValue === null) {
      // For null (cleared selection)
      if (setFieldValue) {
        setFieldValue(name, "");
      } else if (externalOnChange) {
        externalOnChange("");
      }
      
      if (onSelect) onSelect(null);
    } else {
      // For Website object selection
      if (setFieldValue) {
        setFieldValue(name, newValue.url);
      } else if (externalOnChange) {
        externalOnChange(newValue.url);
      }
      
      if (onSelect) onSelect(newValue);
    }
  };

  // Get URL from option (string or Website)
  const getOptionLabel = (option: string | Website): string => {
    return typeof option === "string" ? option : option.url;
  };

  // Convert string value to Website object if found in options
  const convertValue = () => {
    if (fieldValue) {
      const matchingWebsite = options.find((opt) => opt.url === fieldValue);
      return matchingWebsite || fieldValue;
    }
    return null;
  };

  // Helper to automatically add protocol if missing
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const url = event.target.value.trim();
    
    // Mark field as touched in Formik
    if (setFieldTouched) {
      setFieldTouched(name, true, true);
    }
    
    if (url && !url.match(/^https?:\/\//i)) {
      const newUrl = `https://${url}`;
      setInputValue(newUrl);
      
      // Update Formik field or use external handler
      if (setFieldValue) {
        setFieldValue(name, newUrl);
      } else if (externalOnChange) {
        externalOnChange(newUrl);
      }
    }
  };

  return (
    <Autocomplete
      freeSolo
      options={options}
      filterOptions={(x) => x} // Don't filter - we handle this server-side
      getOptionLabel={getOptionLabel}
      loading={loading}
      onInputChange={handleInputChange}
      onChange={handleUrlSelect}
      inputValue={inputValue}
      value={convertValue()}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required
          variant="outlined"
          placeholder={placeholder}
          error={Boolean(fieldError)}
          helperText={fieldError || helperText}
          onBlur={handleBlur} // Add protocol on blur if missing
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
                <InputAdornment position="end">
                  <Tooltip title="Search for existing websites">
                    <IconButton size="small">
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const url = typeof option === "string" ? option : option.url;

        return (
          <li {...props}>
            <Box component="span">{url}</Box>
          </li>
        );
      }}
    />
  );
};

export default WebsiteUrlSearch;