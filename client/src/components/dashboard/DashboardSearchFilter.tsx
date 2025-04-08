//client/src/components/dashboard/DashboardSearchFilter.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { TextField, InputAdornment, IconButton, Box } from '@mui/material';
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
    sx?: object;
}

const DashboardSearchFilter: React.FC<DashboardSearchFilterProps> = ({
    onFilterChange,
    placeholder = "Filter by name or URL...",
    debounceDelay = 300, // Default debounce time: 300ms
    initialValue = '',
    sx = {}
}) => {
    // State to hold the current value entered by the user
    const [searchTerm, setSearchTerm] = useState<string>(initialValue);

    // Effect to handle debouncing the filter change callback
    useEffect(() => {
        // Set up a timer to call onFilterChange after the delay
        const handler = setTimeout(() => {
            // Pass the trimmed search term to the parent
            onFilterChange(searchTerm.trim());
        }, debounceDelay);

        // Cleanup function: Clear the timer if the component unmounts
        // or if the searchTerm changes before the timer fires
        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, debounceDelay, onFilterChange]); // Dependencies: Re-run effect if these change

    // Handler for input changes
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // Handler to clear the search input
    const handleClear = useCallback(() => {
        setSearchTerm('');
        // Optionally trigger filter change immediately on clear,
        // though the useEffect will also handle it after the debounce.
        // onFilterChange('');
    }, [/* onFilterChange */]); // Add onFilterChange if triggering immediately

    return (
        <Box sx={{ width: '100%', maxWidth: 400, ...sx }}> {/* Control width */}
            <TextField
                fullWidth
                size="small" // Smaller size suitable for dashboards
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
                    endAdornment: searchTerm ? ( // Show clear button only if there's text
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
            />
        </Box>
    );
};

export default DashboardSearchFilter;