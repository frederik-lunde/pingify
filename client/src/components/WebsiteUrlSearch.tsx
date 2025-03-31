// Simplified WebsiteUrlSearch.tsx
import React, {useEffect, useMemo } from "react";
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
import { useWebsiteSearch } from "../hooks";
import { debounce } from "lodash";
import { useField, useFormikContext } from "formik";

export interface WebsiteUrlSearchProps {
  name: string; // Field name for Formik
  value?: string;
  onChange?: (url: string) => void;
  onSelect?: (website: Website | null) => void;
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
  label = "Website URL",
  placeholder = "https://example.com",
  helperText = "Full URL including http:// or https://",
  searchLimit = 10,
  disabled = false,
}: WebsiteUrlSearchProps) => {
  // Get Formik context if available
  const formik = useFormikContext();
  const [field, meta, helpers] = useField(name);
  
  // Use values from Formik or from props if used outside of Formik
  const isFormik = !!formik;
  const fieldValue = isFormik ? field?.value : externalValue || "";
  const fieldError = isFormik && meta?.touched ? meta.error : undefined;
  
  // Use our search hook
  const {
    results: options,
    loading,
    search: searchWebsites,
  } = useWebsiteSearch("", searchLimit);

  // Create debounced search function
  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => {
      searchWebsites(searchTerm);
    }, 300),
    [searchWebsites],
  );

  // Load initial options on mount
  useEffect(() => {
    debouncedSearch("");
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  // Handle URL input change
  const handleInputChange = (
    _event: React.SyntheticEvent,
    newValue: string,
  ) => {
    // Update Formik field if within Formik context, otherwise use external handler
    if (isFormik) {
      helpers.setValue(newValue);
      helpers.setTouched(true, false);
    } else if (externalOnChange) {
      externalOnChange(newValue);
    }
    
    debouncedSearch(newValue);
  };

  // Handle URL autocomplete selection
  const handleUrlSelect = (
    _event: React.SyntheticEvent<Element, Event>,
    newValue: string | Website | null,
    _reason: string,
  ) => {
    if (typeof newValue === "string") {
      if (isFormik) {
        helpers.setValue(newValue);
      } else if (externalOnChange) {
        externalOnChange(newValue);
      }
      if (onSelect) onSelect(null);
    } else if (newValue === null) {
      if (isFormik) {
        helpers.setValue("");
      } else if (externalOnChange) {
        externalOnChange("");
      }
      if (onSelect) onSelect(null);
    } else {
      if (isFormik) {
        helpers.setValue(newValue.url);
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
    if (isFormik) {
      helpers.setTouched(true, true);
    }
    
    if (url && !url.match(/^https?:\/\//i)) {
      const newUrl = `https://${url}`;
      
      // Update Formik field or use external handler
      if (isFormik) {
        helpers.setValue(newUrl);
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
      onInputChange={(e, value) => handleInputChange(e, value)}
      onChange={handleUrlSelect}
      inputValue={fieldValue}
      value={convertValue()}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required
          variant="outlined"
          placeholder={placeholder}
          error={!!fieldError}
          helperText={fieldError || helperText}
          onBlur={handleBlur}
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