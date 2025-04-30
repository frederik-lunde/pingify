// src/components/dashboard/DashboardSortControl.tsx
import React, { useState, useCallback } from 'react';
import {
    IconButton, Menu, MenuItem, Tooltip, ListItemIcon, ListItemText, Stack // Removed CircularProgress
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import { SortOption } from '../../types';

interface SortOptionConfig {
    value: SortOption;
    label: string;
    icon: React.ReactElement;
}

const sortOptionsConfig: SortOptionConfig[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <SortByAlphaIcon fontSize="small" /> },
    { value: 'name-desc', label: 'Name (Z-A)', icon: <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)'}}/> },
    { value: 'response-asc', label: 'Response Time (Fastest)', icon: <ArrowUpwardIcon fontSize="small" /> },
    { value: 'response-desc', label: 'Response Time (Slowest)', icon: <ArrowDownwardIcon fontSize="small" /> },
];

interface DashboardSortControlProps {
    sortOption: SortOption;
    onSortChange: (option: SortOption) => void;
    // isFetching prop is no longer needed here as the indicator is moved
}

const DashboardSortControl: React.FC<DashboardSortControlProps> = ({
    sortOption,
    onSortChange,
    // isFetching prop removed
}) => {
    const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
    const openSortMenu = Boolean(sortAnchorEl);

    const handleSortMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setSortAnchorEl(event.currentTarget);
    }, []);

    const handleSortMenuClose = useCallback(() => {
        setSortAnchorEl(null);
    }, []);

    const handleSortOptionSelect = useCallback((option: SortOption) => {
        onSortChange(option);
        handleSortMenuClose();
    }, [onSortChange, handleSortMenuClose]);

    return (
        // Stack is no longer strictly necessary just for the button, but can keep for consistency
        <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Sort websites">
                <IconButton
                    id="sort-button"
                    aria-controls={openSortMenu ? 'sort-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={openSortMenu ? 'true' : undefined}
                    onClick={handleSortMenuClick}
                    color="primary"
                    size="medium"
                >
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            {/* Removed the CircularProgress component */}

            <Menu
                id="sort-menu"
                anchorEl={sortAnchorEl}
                open={openSortMenu}
                onClose={handleSortMenuClose}
                MenuListProps={{ 'aria-labelledby': 'sort-button' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {sortOptionsConfig.map((option) => (
                    <MenuItem
                        key={option.value}
                        selected={option.value === sortOption}
                        onClick={() => handleSortOptionSelect(option.value)}
                    >
                        <ListItemIcon sx={{ minWidth: '36px' }}>{option.icon}</ListItemIcon>
                        <ListItemText primary={option.label} />
                    </MenuItem>
                ))}
            </Menu>
        </Stack>
    );
};

export default DashboardSortControl;