// src/components/dashboard/AddWebsiteCard.tsx
import React from 'react';
import { useNavigate } from 'react-router';
import {
    Card,
    CardActionArea,
    Box,
    useTheme,
    alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const AddWebsiteCard: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();

    const handleClick = () => {
        navigate('/add-website');
    };

    const cardStyles = {
        width: '100%',
        height: '100%', // Make card fill the grid item height
        minHeight: '240px', // Match WebsiteCard's minHeight for consistency
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: '2px',
        borderStyle: 'dashed',
        borderColor: theme.palette.divider,
        transition: theme.transitions.create(['border-color', 'background-color'], {
            duration: theme.transitions.duration.short,
        }),
        '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
    };

    return (
        <Card
            elevation={0}
            sx={cardStyles}
            aria-label="Add new website to monitor"
        >
            <CardActionArea
                onClick={handleClick}
                sx={{
                    width: '100%',
                    height: '100%', // Action area should also fill the card
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Box textAlign="center">
                    <AddIcon
                        sx={{
                            fontSize: 60,
                            color: theme.palette.text.secondary,
                        }}
                    />
                </Box>
            </CardActionArea>
        </Card>
    );
};

export default AddWebsiteCard;