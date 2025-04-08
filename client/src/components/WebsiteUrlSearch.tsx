// src/components/WebsiteUrlSearch.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    TextField,
    Autocomplete,
    CircularProgress,
    debounce,
    FormHelperText,
    Box,
    ListItemIcon,
    ListItemText, 
} from "@mui/material";
import LanguageIcon from '@mui/icons-material/Language';

import { Website } from "../types"; 
import { useWebsiteSearch } from "../hooks/api/useWebsites"; 
import { useField, useFormikContext, FieldHookConfig } from "formik";

// --- Define Props Interface ---
export interface WebsiteUrlSearchProps {
    name: string;
    label?: string;
    placeholder?: string;
    helperText?: string; 
    searchLimit?: number;
    disabled?: boolean;
    required?: boolean; 


    value?: string;
    onChange?: (url: string) => void;
    onSelect?: (website: Website | null) => void; 
    onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

    error?: boolean;
    errorMessage?: string;

    formikConfig?: FieldHookConfig<string>;
}

const WebsiteUrlSearch = ({
    name,
    label = "Website URL or Name",
    placeholder = "Search by URL (e.g., https://example.com) or name",
    helperText = "Enter a URL or name to search existing sites, or enter a new URL.",
    searchLimit = 10,
    disabled = false,
    required = false,
    value: externalValue,
    onChange: externalOnChange,
    onSelect: externalOnSelect,
    onBlur: externalOnBlur,
    error: externalError,
    errorMessage: externalErrorMessage,
    formikConfig = {},
}: WebsiteUrlSearchProps) => {

    // --- Formik Integration ---
    const formik = useFormikContext();
    const isFormik = !!formik; // Check if Formik context exists

    // Use useField hook ONLY IF inside Formik
    // Pass the name and any additional config (like validation)
    const [field, meta, helpers] = isFormik
        ? useField({ name, ...formikConfig })
        : [
              // Dummy field for standalone usage
              {
                  name,
                  value: externalValue ?? "", // Use externalValue or default
                  onChange: (e: React.ChangeEvent<any>) => {
                      if (externalOnChange) externalOnChange(e.target.value);
                  },
                  onBlur: (e: React.FocusEvent<any>) => {
                      if (externalOnBlur) externalOnBlur(e);
                  },
              },
              {
                  value: externalValue ?? "",
                  error: externalErrorMessage,
                  touched: externalError !== undefined,
                  initialValue: "",
                  initialTouched: false,
                  initialError: undefined,
              },
              {
                  setValue: (value: string) => {
                      if (externalOnChange) externalOnChange(value);
                  },
                  setTouched: () => {},
                  setError: () => {},
              },
          ];

    const { setValue: setFieldValue, setTouched: setFieldTouched } = helpers;


    const [inputValue, setInputValue] = useState(field.value || "");

    useEffect(() => {
        setInputValue(field.value || "");
    }, [field.value]);

    const hasError = externalError ?? (isFormik && meta.touched && !!meta.error);
    const displayMessage = hasError
        ? (externalErrorMessage ?? (isFormik ? meta.error : ""))
        : helperText; 

    // --- Search Hook & Debounce ---
    const {
        results: options,
        loading,
        error: searchError,
        search: searchWebsites,
    } = useWebsiteSearch(searchLimit);

    // Debounced search function
    const debouncedSearch = useMemo(
        () =>
            debounce((searchTerm: string) => {
                if (searchTerm && searchTerm.trim().length > 1) { 
                    searchWebsites(searchTerm);
                }
            }, 400),
        [searchWebsites]
    );

    // --- Event Handlers ---

    // Handles changes to the text input field itself
    const handleInputChange = useCallback(
        (_event: React.SyntheticEvent, newValue: string, reason: string) => {
            setInputValue(newValue); 
            if (reason === 'input') {
                if (isFormik) {
                     setFieldValue(newValue);
                 } else if (externalOnChange) {
                     externalOnChange(newValue);
                 }
                debouncedSearch(newValue);
            }
             else if (reason === 'clear') {
                  if (isFormik) {
                      setFieldValue('');
                  } else if (externalOnChange) {
                      externalOnChange('');
                  }
                  if (externalOnSelect) {
                      externalOnSelect(null);
                  }
             }

        },
        [isFormik, setFieldValue, externalOnChange, debouncedSearch, externalOnSelect]
    );

    const handleSelectionChange = useCallback(
        (
            _event: React.SyntheticEvent,
            selectedValue: string | Website | null,
        ) => {
            let finalUrl = "";
            let selectedWebsite: Website | null = null;

            if (typeof selectedValue === "string") {
                finalUrl = selectedValue.trim();
                 finalUrl = ensureUrlProtocol(finalUrl);
            } else if (selectedValue && typeof selectedValue === 'object' && 'url' in selectedValue) {
                finalUrl = selectedValue.url;
                selectedWebsite = selectedValue;
            }
             else {
                 finalUrl = "";
                 selectedWebsite = null;
             }


             setInputValue(finalUrl);

            if (isFormik) {
                setFieldValue(finalUrl);
                setFieldTouched(true, false);
            } else if (externalOnChange) {
                externalOnChange(finalUrl);
            }

            if (externalOnSelect) {
                externalOnSelect(selectedWebsite);
            }
        },
        [isFormik, setFieldValue, setFieldTouched, externalOnChange, externalOnSelect]
    );

    // Helper to ensure URL has a protocol (basic check)
    const ensureUrlProtocol = (url: string): string => {
        if (!url || typeof url !== 'string') return ""; // Handle non-string inputs
        const trimmedUrl = url.trim();
        if (!trimmedUrl) return ""; // Handle empty string after trim
        // Simple check if it starts with http://, https://, or ftp://
        if (!/^(https?|ftp):\/\//i.test(trimmedUrl)) {
            // Basic check if it looks like a domain name (contains '.')
            // Avoid prepending to partial inputs like 'exa'
            if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ') && !trimmedUrl.startsWith('/')) {
                return `https://${trimmedUrl}`;
            }
             // Otherwise, return the trimmed URL as is (might be a name or partial input)
            return trimmedUrl;
        }
        return trimmedUrl; // Return already valid or trimmed URL
    };

    // Custom Blur Handler
    const handleBlur = useCallback(
        (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (isFormik) {
                 field.onBlur(event);
            }

            if (externalOnBlur) {
                externalOnBlur(event);
            }

            const currentValue = field.value || event.target.value || '';
            const formattedUrl = ensureUrlProtocol(currentValue);
            if (formattedUrl !== currentValue) {
                setInputValue(formattedUrl);
                if (isFormik) {
                    setFieldValue(formattedUrl);
                } else if (externalOnChange) {
                    externalOnChange(formattedUrl);
                }
            }
        },
        [isFormik, field, externalOnBlur, setFieldValue, externalOnChange]
    );

    // --- Autocomplete Value ---
    const autocompleteValue = useMemo(() => {
        const currentFieldValue = field.value || '';
        if (!currentFieldValue) {
            return null;
        }
        const matchedOption = options.find(
            (opt): opt is Website => typeof opt !== 'string' && opt.url === currentFieldValue
        );
        return matchedOption || currentFieldValue;
    }, [field.value, options]);


    return (
        // Use Box to contain Autocomplete and custom FormHelperText
        <Box sx={{ width: '100%' }}> {/* Ensure Box takes full width */}
            <Autocomplete
                freeSolo // Allows arbitrary input not present in options
                autoSelect // Select highlighted option on blur/enter
                options={options} // API search results
                filterOptions={(x) => x} // Disable frontend filtering, API does it
                getOptionLabel={(option) => // How to display options in the input field when selected
                    typeof option === "string" ? option : option.url
                 }
                 isOptionEqualToValue={(option, val) => // How to check if an option matches the current value
                     typeof option === 'string' && typeof val === 'string' ? option === val :
                     typeof option !== 'string' && typeof val !== 'string' ? option.id === val.id : // Compare by ID if both are objects
                     false
                 }
                // Custom rendering for options in the dropdown list
                renderOption={(props, option) => (
                    <li {...props} key={typeof option === 'string' ? option : option.id}>
                        <ListItemIcon sx={{ minWidth: '36px'}}> {/* Adjust spacing */}
                             <LanguageIcon fontSize="small" color="action"/>
                        </ListItemIcon>
                        <ListItemText
                             primary={typeof option === 'string' ? option : (option.name || option.url)}
                             secondary={typeof option === 'string' ? null : (option.name ? option.url : null)} // Show URL as secondary if name exists
                             primaryTypographyProps={{ style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                            secondaryTypographyProps={{ style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                        />

                    </li>
                )}
                 // --- Control Autocomplete State ---
                 value={autocompleteValue} // Controlled value (object or string or null)
                 inputValue={inputValue} // Controlled input text state
                 onInputChange={handleInputChange} // Handle typing in the input
                 onChange={handleSelectionChange} // Handle selecting an option or pressing Enter
                 onBlur={(event) => {
                     if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                         handleBlur(event as React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>);
                     }
                 }} // Use our combined blur handler

                 // --- Other Props ---
                loading={loading}
                disabled={disabled}
                // Render the TextField input component
                renderInput={(params) => (
                    <TextField
                        {...params}
                        // --- Pass Formik/Component Props ---
                        // name={field.name} // Autocomplete handles name propagation via params
                        label={label}
                        variant="outlined"
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled} // Ensure TextField also gets disabled state
                        // --- Error State ---
                        error={hasError} // Pass final calculated error state
                        // --- IMPORTANT: DO NOT PASS helperText here ---
                        // We render FormHelperText separately below
                        // helperText={displayMessage} // REMOVED

                        // --- Loading Indicator ---
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} sx={{ mr: params.InputProps.endAdornment ? 4 : 1 }} /> : null} {/* Adjust spacing */}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                    />
                )}
            />
            {/* Conditionally render FormHelperText *outside* the TextField */}
            {/* This ensures consistent spacing and allows showing default/error text correctly */}
            {(displayMessage || searchError) && ( // Show if there's a display message OR a search error
                 <FormHelperText
                     error={hasError || !!searchError} // Mark as error if Formik/external error OR search error
                     sx={{ marginLeft: '14px', marginRight: '14px' }} // Standard MUI helper text indentation
                 >
                     {hasError ? displayMessage : (searchError?.message || displayMessage)}
                 </FormHelperText>
             )}
        </Box>
    );
};

export default WebsiteUrlSearch;