import React from 'react';
import { Typography, Box } from '@mui/material';

interface EmptyFilterResultsProps {
    isTvMode?: boolean; 
}

const EmptyFilterResults: React.FC<EmptyFilterResultsProps> = ({ isTvMode = false }) => {
    const containerStyles = isTvMode
        ? { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }
        : { mt: 4 }; 

    return (
        <Box sx={containerStyles}>
            <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: isTvMode ? '1.5rem' : undefined }}>
                No websites match your current filter.
            </Typography>
        </Box>
    );
};

export default EmptyFilterResults;