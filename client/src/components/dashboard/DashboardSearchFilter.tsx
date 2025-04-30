/*
client/src/components/dashboard/DashboardSearchFilter.tsx
*/
import React, { useState, useEffect, useCallback } from 'react';
import { TextField, InputAdornment, IconButton, Box, SxProps, Theme } from '@mui/material'; // Import SxProps and Theme
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface DashboardSearchFilterProps {
    /** Callback function triggered when the debounced search term changes. */
    onFilterChange: (filterTerm: string) => void;
    /** Placeholder text for the input field. */
    placeholder?: string;
    /** Debounce delay in milliseconds. */
    debounceDelay?: number;
    /** Initial value for the filter (optional). */
    initialValue?: string;
    /** Styling for the root Box element */
    sx?: SxProps<Theme>; // Use SxProps for better type checking
}

const DashboardSearchFilter: React.FC<DashboardSearchFilterProps> = ({
    onFilterChange,
    placeholder = "Filter by name or URL...",
    debounceDelay = 300,
    initialValue = '',
    sx = {}
}) => {
    const [searchTerm, setSearchTerm] = useState<string>(initialValue);

    // Effect to handle debouncing
    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange(searchTerm.trim());
        }, debounceDelay);

        return () => {
            clearTimeout(handler);
        };
        // Only re-run if these specific props change
    }, [searchTerm, debounceDelay, onFilterChange]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // Handler to clear the search input
    const handleClear = useCallback(() => {
        setSearchTerm('');
    }, []); 

    return (
        <Box sx={{ width: '100%', maxWidth: 400, ...sx }}>
            <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder={placeholder}
                value={searchTerm}
                onChange={handleChange}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                        <InputAdornment position="end">
                            <IconButton
                                aria-label="clear search"
                                onClick={handleClear}
                                edge="end"
                                size="small"
                            >
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
                aria-label={placeholder} // Add aria-label for accessibility
            />
        </Box>
    );
};

export default DashboardSearchFilter;