import React from 'react';
import { Container, Alert, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ApiError } from '../../types';

interface DataFetchErrorProps {
    error: ApiError | Error | null;
    onRetry: () => void;
    context?: string;
    minHeight?: string | number;
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
            {}
            <ErrorOutlineIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom>
                Failed to Load {context}
            </Typography>
            {}
            <Alert
                severity="error"
                icon={false}
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