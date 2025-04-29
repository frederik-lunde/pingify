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
import { useField, FieldHookConfig, useFormikContext } from "formik";

export interface WebsiteUrlSearchProps {
    name: string;
    label?: string;
    placeholder?: string;
    helperText?: string;
    searchLimit?: number;
    disabled?: boolean;
    required?: boolean;
    onSelect?: (website: Website | null) => void;
    formikConfig?: Omit<FieldHookConfig<string>, 'name'>;
}

const WebsiteUrlSearch: React.FC<WebsiteUrlSearchProps> = ({
    name,
    label = "Website URL or Name",
    placeholder = "Search by URL (e.g., https://example.com) or name",
    helperText = "Enter a URL or name to search existing sites, or enter a new URL.",
    searchLimit = 10,
    disabled = false,
    required = false,
    onSelect: externalOnSelect,
    formikConfig = {},
}) => {
    // --- Formik Hooks ---
    const [field, meta, helpers] = useField({ name, ...formikConfig });
    const { setValue, setTouched } = helpers;
    const { isSubmitting } = useFormikContext();

    // --- State ---
    const [inputValue, setInputValue] = useState(field.value || "");

    // Sync internal state if Formik value changes
    useEffect(() => {
        if (field.value !== inputValue) {
            setInputValue(field.value || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.value]);

    // --- Search Hook & Debounce ---
    const {
        results: options,
        loading,
        error: searchError,
        search: searchWebsites,
    } = useWebsiteSearch(searchLimit);

    const debouncedSearch = useMemo(
        () =>
            debounce((searchTerm: string) => {
                if (searchTerm && searchTerm.trim().length > 1) {
                    searchWebsites(searchTerm);
                }
            }, 400),
        [searchWebsites]
    );

    // --- URL Formatting ---
    const ensureUrlProtocol = useCallback((url: string): string => {
        if (!url || typeof url !== 'string') return "";
        const trimmedUrl = url.trim();
        if (!trimmedUrl) return "";
        if (!/^(https?|ftp):\/\//i.test(trimmedUrl)) {
            if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ') && !trimmedUrl.startsWith('/')) {
                return `https://${trimmedUrl}`;
            }
            return trimmedUrl;
        }
        return trimmedUrl;
    }, []);

    // --- Event Handlers ---
    const handleInputChange = useCallback(
        (_event: React.SyntheticEvent, newValue: string, reason: string) => {
            setInputValue(newValue);
            if (reason === 'input') {
                setValue(newValue);
                debouncedSearch(newValue);
            } else if (reason === 'clear') {
                setValue('');
                if (externalOnSelect) externalOnSelect(null);
            }
        },
        [setValue, externalOnSelect, debouncedSearch]
    );

    // --- FIX: Remove the explicit generic type argument ---
    const handleSelectionChange = useCallback(
        (
            _event: React.SyntheticEvent, // Type inferred correctly
            selectedValue: string | Website | null, // Type inferred correctly
        ) => {
            let finalUrl = "";
            let selectedWebsite: Website | null = null;

            if (typeof selectedValue === "string") {
                finalUrl = ensureUrlProtocol(selectedValue.trim());
            } else if (selectedValue && typeof selectedValue === 'object' && 'url' in selectedValue) {
                // selectedValue is a Website object
                finalUrl = selectedValue.url;
                selectedWebsite = selectedValue;
            }

            setInputValue(finalUrl);
            setValue(finalUrl);
            setTouched(true, false); // Mark touched on selection

            if (externalOnSelect) {
                externalOnSelect(selectedWebsite);
            }
        },
        [ensureUrlProtocol, setValue, setTouched, externalOnSelect] // Dependencies remain the same
    );

    // --- Autocomplete Value Prop ---
    const autocompleteValue = useMemo(() => {
        if (!field.value) return null;
        const matchedOption = options.find(
            (opt): opt is Website => typeof opt !== 'string' && opt.url === field.value
        );
        return matchedOption || field.value;
    }, [field.value, options]);

    // --- Final Helper/Error Text ---
    const hasError = (meta.touched && !!meta.error) || !!searchError;
    const finalHelperText = hasError
        ? (meta.error || searchError?.message)
        : helperText;

    // --- Render ---
    return (
        <Box sx={{ width: '100%' }}>
            <Autocomplete<string | Website, false, false, true> // Keep type params on Autocomplete itself
                freeSolo
                autoSelect
                options={options}
                filterOptions={(x) => x}
                getOptionLabel={(option) => typeof option === "string" ? option : option.url}
                isOptionEqualToValue={(option, val) =>
                    typeof option === 'string' && typeof val === 'string' ? option === val :
                    typeof option !== 'string' && typeof val !== 'string' ? option.id === val.id :
                    false
                }
                renderOption={(props, option) => (
                     <li {...props} key={typeof option === 'string' ? option : option.id}>
                        <ListItemIcon sx={{ minWidth: '36px' }}>
                            <LanguageIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                            primary={typeof option === 'string' ? option : (option.name || option.url)}
                            secondary={typeof option === 'string' ? null : (option.name ? option.url : null)}
                            primaryTypographyProps={{ style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                            secondaryTypographyProps={{ style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                        />
                    </li>
                )}
                // --- Control Autocomplete State ---
                value={autocompleteValue}
                inputValue={inputValue}
                onInputChange={handleInputChange}
                onChange={handleSelectionChange} // Pass correctly inferred handler
                // onBlur is handled by renderInput's TextField below
                loading={loading}
                disabled={disabled || isSubmitting}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        name={field.name}
                        // Attach Formik's onBlur and our custom logic
                        onBlur={(event) => {
                            field.onBlur(event);
                            const currentValue = event.target.value || '';
                             if (currentValue) {
                                const formattedUrl = ensureUrlProtocol(currentValue);
                                if (formattedUrl !== field.value) {
                                    setInputValue(formattedUrl);
                                    setValue(formattedUrl);
                                }
                            }
                        }}
                        label={label}
                        variant="outlined"
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled || isSubmitting}
                        error={hasError}
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} sx={{ mr: params.InputProps.endAdornment ? 4 : 1 }} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                    />
                )}
            />
            {(finalHelperText) && (
                <FormHelperText
                    error={hasError}
                    sx={{ marginLeft: '14px', marginRight: '14px' }}
                >
                    {finalHelperText}
                </FormHelperText>
            )}
        </Box>
    );
};

export default WebsiteUrlSearch;