// src/pages/NotFoundPage.tsx
import React from 'react';
import { Container, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // Or another suitable icon

const NotFoundPage: React.FC = () => {
    return (
        <Container maxWidth="sm" sx={{ textAlign: 'center', mt: '20vh' }}>
            <Box sx={{ mb: 3 }}>
                <ErrorOutlineIcon sx={{ fontSize: 80, color: 'text.secondary' }} />
            </Box>
            <Typography variant="h3" component="h1" gutterBottom>
                404 - Page Not Found
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                Oops! The page you are looking for does not exist or has been moved.
            </Typography>
            <Button
                variant="contained"
                component={RouterLink}
                to="/" // Link to the dashboard or home page
            >
                Go to Dashboard
            </Button>
        </Container>
    );
};

export default NotFoundPage;