import React, { useState, useEffect } from 'react';
import { 
  TextField, 
  Autocomplete, 
  CircularProgress, 
  Box 
} from '@mui/material';
import { debounce } from 'lodash';
import { searchWebsites } from '../api/websites';

interface WebsiteAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onWebsiteSelect: (website: any) => void;
}

const WebsiteAutocomplete: React.FC<WebsiteAutocompleteProps> = ({
  value,
  onChange,
  onWebsiteSelect
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Debounced search function
  const searchWebsitesDebounced = React.useCallback(
    debounce(async (searchTerm: string) => {
      if (searchTerm.length < 3) return;
      
      setLoading(true);
      try {
        const results = await searchWebsites(searchTerm);
        setOptions(results);
      } catch (error) {
        console.error('Error searching websites:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );
  
  useEffect(() => {
    if (inputValue) {
      searchWebsitesDebounced(inputValue);
    } else {
      setOptions([]);
    }
  }, [inputValue, searchWebsitesDebounced]);
  
  return (
    <Autocomplete
      freeSolo
      options={options}
      getOptionLabel={(option) => 
        typeof option === 'string' ? option : option.url
      }
      filterOptions={(x) => x} // Disable the built-in filtering
      value={value}
      onChange={(event, newValue) => {
        // If user selects an existing website
        if (newValue && typeof newValue !== 'string') {
          onChange(newValue.url);
          onWebsiteSelect(newValue);
        } else {
          // If user enters a custom URL
          onChange(newValue || '');
        }
      }}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Website URL"
          variant="outlined"
          fullWidth
          required
          placeholder="https://example.com"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <div>
            <div>{option.url}</div>
            <div style={{ fontSize: '0.8rem', color: 'gray' }}>
              {`${option.monitoringResults?.length || 0} checks`}
            </div>
          </div>
        </Box>
      )}
    />
  );
};

export default WebsiteAutocomplete;