// client/src/components/WebsiteUrlSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Autocomplete,
  CircularProgress,
  InputAdornment,
  Tooltip,
  IconButton,
  Box
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { Website } from '../types';
import { searchWebsites } from '../api/websites';
import { debounce } from 'lodash';

export interface WebsiteUrlSearchProps {
  value: string;
  onChange: (url: string) => void;
  onSelect: (website: Website | null) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
}

const WebsiteUrlSearch = ({
  value,
  onChange,
  onSelect,
  error,
  label = "Website URL",
  placeholder = "https://example.com",
  helperText = "Full URL including http:// or https://"
}: WebsiteUrlSearchProps) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<Website[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm: string) => {
      try {
        setLoading(true);
        const results = await searchWebsites(searchTerm);
        setOptions(results);
      } catch (err) {
        console.error('Error searching websites:', err);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Load initial options on mount
  useEffect(() => {
    debouncedSearch('');
    
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle URL input change
  const handleInputChange = (_event: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    debouncedSearch(newInputValue);
  };

  // Handle URL autocomplete selection
  const handleUrlSelect = (
    _event: React.SyntheticEvent<Element, Event>,
    newValue: string | Website | null,
    _reason: string
  ) => {
    if (typeof newValue === 'string') {
      onChange(newValue);
      onSelect(null);
    } else if (newValue === null) {
      onChange('');
      onSelect(null);
    } else {
      onChange(newValue.url);
      onSelect(newValue);
    }
  };

  // Get URL from option (string or Website)
  const getOptionUrl = (option: string | Website): string => {
    return typeof option === 'string' ? option : option.url;
  };

  // Convert string value to Website object if found in options
  const convertValue = () => {
    if (value) {
      const matchingWebsite = options.find(opt => opt.url === value);
      return matchingWebsite || value;
    }
    return null;
  };

  return (
    <Autocomplete
      freeSolo
      options={options}
      filterOptions={(x) => x} // Don't filter - we handle this server-side
      getOptionLabel={getOptionUrl}
      loading={loading}
      onInputChange={handleInputChange}
      onChange={handleUrlSelect}
      inputValue={inputValue}
      value={convertValue()}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required
          variant="outlined"
          placeholder={placeholder}
          error={!!error}
          helperText={error || helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
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
        // We know that in renderOption, option is a Website because it comes from the options array
        // But TypeScript doesn't know this, so we need to type assertion or type-check
        const url = typeof option === 'string' ? option : option.url;
        
        return (
          <li {...props}>
            <Box component="span">
              {url}
            </Box>
          </li>
        );
      }}
    />
  );
};

export default WebsiteUrlSearch;