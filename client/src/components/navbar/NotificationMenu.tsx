import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { getAlertTypeColor } from '../../utils/statusUtils';
import { formatDistanceToNow } from 'date-fns';
import { AlertUser } from '../../types';
import { useUserUnreadAlerts } from '../../api/hooks/useAlerts';

interface NotificationMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

const NotificationMenu: React.FC<NotificationMenuProps> = ({ 
  anchorEl, 
  open, 
  onClose 
}) => {
  const navigate = useNavigate();
  
  // Use our hook to fetch unread alerts and access the mark as read functions
  const { 
    unreadAlerts = [], 
    loading, 
    markAsRead, 
    markAllAsRead 
  } = useUserUnreadAlerts(10, undefined, undefined, undefined, false);

  // Handle clicking on an alert - mark it as read and navigate to the website
  const handleAlertClick = useCallback(async (alertUser: AlertUser) => {
    try {
      const alert = alertUser.alert;
      await markAsRead(alert.id);
      onClose();
      navigate(`/website/${alert.websiteId}`);
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }, [markAsRead, navigate, onClose]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  }, [markAllAsRead]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: '400px',
          width: '350px',
        }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Alerts
        </Typography>
        <Button 
          size="small"
          variant="text"
          color="primary"
          onClick={handleMarkAllAsRead}
          disabled={(unreadAlerts ?? []).length === 0 || loading}
          sx={{
            textTransform: 'none',
            minWidth: 'auto'
          }}
        >
          Mark all as read
        </Button>
      </Stack>
      <Divider />
      
      {loading ? (
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            Loading alerts...
          </Typography>
        </MenuItem>
      ) : (unreadAlerts ?? []).length === 0 ? (
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            No new alerts
          </Typography>
        </MenuItem>
      ) : (
        (unreadAlerts ?? []).map((alertUser) => {
          const alert = alertUser.alert;
          const websiteName = alert.website?.websiteUsers?.[0]?.name || alert.website?.url || 'Unknown Website';
          
          return (
            <MenuItem 
              key={alertUser.id} 
              onClick={() => handleAlertClick(alertUser)}
              sx={{
                bgcolor: !alertUser.isRead ? 'action.hover' : 'inherit',
                '&:hover': {
                  backgroundColor: 'action.selected',
                }
              }}
            >
              <ListItemIcon>
                <FiberManualRecordIcon 
                  fontSize="small" 
                  color={getAlertTypeColor(alert.type)} 
                />
              </ListItemIcon>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {websiteName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {alert.message}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </Typography>
            </MenuItem>
          );
        })
      )}
    </Menu>
  );
};

export default NotificationMenu;