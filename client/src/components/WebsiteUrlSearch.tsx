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

/**
 * An Autocomplete component for searching and selecting website URLs, integrated with Formik.
 */
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
    const [field, meta, helpers] = useField({ name, ...formikConfig });
    const { setValue, setTouched } = helpers;
    const { isSubmitting } = useFormikContext();
    const [inputValue, setInputValue] = useState(field.value || "");

    /**
     * Synchronizes internal input value with Formik field value.
     */
    useEffect(() => {
        if (field.value !== inputValue) {
            setInputValue(field.value || "");
        }
    }, [field.value]);

    const {
        results: options,
        loading,
        error: searchError,
        search: searchWebsites,
    } = useWebsiteSearch(searchLimit);

    /**
     * Debounces the website search API call.
     */
    const debouncedSearch = useMemo(
        () =>
            debounce((searchTerm: string) => {
                if (searchTerm && searchTerm.trim().length > 1) {
                    searchWebsites(searchTerm);
                }
            }, 400),
        [searchWebsites]
    );

    /**
     * Ensures a URL string has a protocol (http/https).
     */
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

    /**
     * Handles changes to the Autocomplete input field.
     */
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

    /**
     * Handles selection of an item from the Autocomplete suggestions.
     */
    const handleSelectionChange = useCallback(
        (
            _event: React.SyntheticEvent,
            selectedValue: string | Website | null,
        ) => {
            let finalUrl = "";
            let selectedWebsite: Website | null = null;
            if (typeof selectedValue === "string") {
                finalUrl = ensureUrlProtocol(selectedValue.trim());
            } else if (selectedValue && typeof selectedValue === 'object' && 'url' in selectedValue) {
                finalUrl = selectedValue.url;
                selectedWebsite = selectedValue;
            }
            setInputValue(finalUrl);
            setValue(finalUrl);
            setTouched(true, false);
            if (externalOnSelect) {
                externalOnSelect(selectedWebsite);
            }
        },
        [ensureUrlProtocol, setValue, setTouched, externalOnSelect]
    );

    const autocompleteValue = useMemo(() => {
        if (!field.value) return null;
        const matchedOption = options.find(
            (opt): opt is Website => typeof opt !== 'string' && opt.url === field.value
        );
        return matchedOption || field.value;
    }, [field.value, options]);

    const hasError = (meta.touched && !!meta.error) || !!searchError;
    const finalHelperText = hasError
        ? (meta.error || searchError?.message)
        : helperText;

    return (
        <Box sx={{ width: '100%' }}>
            <Autocomplete<string | Website, false, false, true>
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
                value={autocompleteValue}
                inputValue={inputValue}
                onInputChange={handleInputChange}
                onChange={handleSelectionChange}
                loading={loading}
                disabled={disabled || isSubmitting}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        name={field.name}
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