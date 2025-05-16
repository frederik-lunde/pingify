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
    formatUrlInput?: (url: string) => string;
}

const WebsiteUrlSearch: React.FC<WebsiteUrlSearchProps> = ({
    name,
    label = "Website URL or Name",
    placeholder = "Search by URL (e.g., https://www.example.com) or name",
    helperText = "Enter a URL or name to search existing sites, or enter a new URL.",
    searchLimit = 10,
    disabled = false,
    required = false,
    onSelect: externalOnSelect,
    formikConfig = {},
    formatUrlInput,
}) => {
    const [field, meta, helpers] = useField({ name, ...formikConfig });
    const { setValue, setTouched } = helpers;
    const { isSubmitting } = useFormikContext();
    
    const [inputValue, setInputValue] = useState(field.value || "");

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
   
    const debouncedSearch = useMemo(
        () =>
            debounce((searchTerm: string) => {
                if (searchTerm && searchTerm.trim().length > 1) {
                    searchWebsites(searchTerm);
                }
            }, 400),
        [searchWebsites]
    );

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

    const handleSelectionChange = useCallback(
        (
            _event: React.SyntheticEvent,
            selectedValue: string | Website | null,
        ) => {
            let urlToSetInFormik = "";
            let selectedWebsiteObject: Website | null = null;

            if (typeof selectedValue === "string") {
                urlToSetInFormik = selectedValue.trim();
            } else if (selectedValue && typeof selectedValue === 'object' && 'url' in selectedValue) {
                urlToSetInFormik = selectedValue.url;
                selectedWebsiteObject = selectedValue;
            }
            
            const valueForFormik = formatUrlInput ? formatUrlInput(urlToSetInFormik) : urlToSetInFormik;
            
            setInputValue(valueForFormik);
            setValue(valueForFormik);
            setTouched(true, false); 

            if (externalOnSelect) {
                externalOnSelect(selectedWebsiteObject);
            }
        },
        [setValue, setTouched, externalOnSelect, formatUrlInput]
    );

    const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        field.onBlur(event);
        const currentValueOnBlur = event.target.value || '';
        
        if (formatUrlInput) {
            const formattedValue = formatUrlInput(currentValueOnBlur);
            setInputValue(formattedValue);
            if (formattedValue !== field.value) {
                setValue(formattedValue);
            }
        } else {
            if (currentValueOnBlur !== field.value) {
                setValue(currentValueOnBlur);
            }
        }
    }, [field, setValue, formatUrlInput]);

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
                getOptionLabel={(option) => typeof option === "string" ? option : (option.name || option.url)}
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
                        onBlur={handleBlur}
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