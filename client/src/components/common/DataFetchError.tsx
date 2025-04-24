// src/components/common/DataFetchError.tsx
import React from 'react';
import { Container, Alert, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ApiError } from '../../types'; // Adjust path as needed

interface DataFetchErrorProps {
    error: ApiError | Error | null; // Accept different error types
    onRetry: () => void;
    context?: string; // Optional context for the error message
    minHeight?: string | number; // Optional min height for centering
}

const DataFetchError: React.FC<DataFetchErrorProps> = ({
    error,
    onRetry,
    context = 'data',
    minHeight = '70vh',
}) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return (
        <Container
            maxWidth="sm"
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                minHeight: minHeight,
                py: 4,
            }}
        >
            {/* Keep your custom main icon */}
            <ErrorOutlineIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom>
                Failed to Load {context}
            </Typography>
            {/* Add icon={false} to the Alert component */}
            <Alert
                severity="error"
                icon={false} // This removes the default icon on the left
                sx={{ mb: 3, width: '100%', justifyContent: 'center' }}
            >
                {errorMessage}
            </Alert>
            <Button variant="outlined" onClick={onRetry}>
                Retry
            </Button>
        </Container>
    );
};

export default DataFetchError;