// src/components/dashboard/EmptyFilterResults.tsx (NEW FILE)
import React from 'react';
import { Typography } from '@mui/material';

const EmptyFilterResults: React.FC = () => (
    <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
        No websites match your current filter.
    </Typography>
);

export default EmptyFilterResults;