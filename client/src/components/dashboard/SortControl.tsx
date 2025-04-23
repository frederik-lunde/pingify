// src/components/dashboard/DashboardSortControl.tsx (NEW FILE)
import React, { useState, useCallback } from 'react';
import {
    IconButton, Menu, MenuItem, Tooltip, ListItemIcon, ListItemText, CircularProgress, Stack
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import { SortOption } from '../../types'; // Adjust path

interface SortOptionConfig {
    value: SortOption;
    label: string;
    icon: React.ReactElement;
}

// Keep this config here as it's directly tied to this component's UI
const sortOptionsConfig: SortOptionConfig[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <SortByAlphaIcon fontSize="small" /> },
    { value: 'name-desc', label: 'Name (Z-A)', icon: <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)'}}/> },
    { value: 'response-asc', label: 'Response Time (Fastest)', icon: <ArrowUpwardIcon fontSize="small" /> },
    { value: 'response-desc', label: 'Response Time (Slowest)', icon: <ArrowDownwardIcon fontSize="small" /> },
];

interface DashboardSortControlProps {
    sortOption: SortOption;
    onSortChange: (option: SortOption) => void;
    isFetching: boolean; // To show spinner next to button
}

const DashboardSortControl: React.FC<DashboardSortControlProps> = ({
    sortOption,
    onSortChange,
    isFetching,
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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
            <Tooltip title="Sort websites">
                <IconButton
                    id="sort-button"
                    aria-controls={openSortMenu ? 'sort-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={openSortMenu ? 'true' : undefined}
                    onClick={handleSortMenuClick}
                    color="primary"
                >
                    <FilterListIcon />
                </IconButton>
            </Tooltip>
            {isFetching && <CircularProgress size={20} sx={{ ml: 1 }} />} {/* Spinner logic remains */}

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