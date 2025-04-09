//client/src/components/dashboard/DownWebsitesList.tsx
import React from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Divider,
    Paper,
    IconButton,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DownWebsitesListProps {
    websites: Array<{
        id: number;
        name: string;
        lastDownTime: string;
    }>;
    onClose: () => void;
}

const DownWebsitesList: React.FC<DownWebsitesListProps> = ({ websites, onClose }) => {
    return (
        <Paper elevation={3} sx={{ 
            position: 'absolute',
            zIndex: 1300,
            width: '300px',
            maxHeight: '400px',
            overflow: 'auto',
            mt: 1
        }}>
            <Box sx={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText'
            }}>
                <Typography variant="h6">
                    <WarningAmberIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Down Websites (24h)
                </Typography>
                <Tooltip title="Close">
                    <IconButton onClick={onClose} size="small" color="inherit">
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <List dense>
                {websites.map((website, index) => (
                    <React.Fragment key={website.id}>
                        <ListItem>
                            <ListItemText
                                primary={website.name}
                                secondary={`Down at: ${new Date(website.lastDownTime).toLocaleString()}`}
                            />
                        </ListItem>
                        {index < websites.length - 1 && <Divider />}
                    </React.Fragment>
                ))}
            </List>
        </Paper>
    );
};

export default DownWebsitesList;