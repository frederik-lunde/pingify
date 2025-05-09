import React, { useState, useEffect, useCallback } from 'react';
import { TextField, InputAdornment, IconButton, Box, SxProps, Theme } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface DashboardSearchFilterProps {
    onFilterChange: (filterTerm: string) => void;
    placeholder?: string;
    debounceDelay?: number;
    initialValue?: string;
    sx?: SxProps<Theme>;
}

/**
 * A search filter component with debouncing for dashboard filtering.
 */
const DashboardSearchFilter: React.FC<DashboardSearchFilterProps> = ({
    onFilterChange,
    placeholder = "Filter by name or URL...",
    debounceDelay = 300,
    initialValue = '',
    sx = {}
}) => {
    const [searchTerm, setSearchTerm] = useState<string>(initialValue);

    /**
     * Debounces the search term and calls onFilterChange.
     */
    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange(searchTerm.trim());
        }, debounceDelay);
        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, debounceDelay, onFilterChange]);

    /**
     * Updates the search term state on input change.
     */
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    /**
     * Clears the search input field.
     */
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
                aria-label={placeholder}
            />
        </Box>
    );
};

export default DashboardSearchFilter;