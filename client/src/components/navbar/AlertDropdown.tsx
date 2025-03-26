import React, { useCallback } from 'react';
import { 
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Stack,
  Typography,
  Button,
  Divider,
  ListItemIcon,
  Box
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router';
import { useUserUnreadAlerts } from '../../api/hooks/useAlerts';
import { AlertUser } from '../../types';
import { getAlertTypeColor } from '../../utils/statusUtils';

interface AlertsDropdownProps {
  limit?: number;
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({ limit = 50 }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const navigate = useNavigate();

  // Use our hook with the existing parameter format
  const { 
    unreadAlerts = [], 
    loading, 
    markAsRead, 
    markAllAsRead 
  } = useUserUnreadAlerts(
    limit,       // limit
    undefined,   // type
    undefined,   // from
    undefined,   // to
    false        // isResolved - only showing unresolved alerts
  );

  const handleOpenAlerts = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseAlerts = () => {
    setAnchorEl(null);
  };

  const handleAlertClick = useCallback(async (alertUser: AlertUser) => {
    try {
      const alert = alertUser.alert;
      await markAsRead(alert.id);
      handleCloseAlerts();
      navigate(`/website/${alert.websiteId}`);
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }, [markAsRead, navigate]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  }, [markAllAsRead]);

  // Count unresolved unread alerts for the badge
  const unresolvedCount = (unreadAlerts ?? []).filter(item => !item.alert.isResolved).length;

  return (
    <>
      {/* Notifications Icon */}
      <Tooltip title="Alerts">
        <IconButton
          aria-label={`Show ${unresolvedCount} alerts`}
          color="inherit"
          onClick={handleOpenAlerts}
          sx={{ opacity: loading ? 0.7 : 1 }}
        >
          <Badge 
            badgeContent={unresolvedCount} 
            color="error"
            max={9}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notifications Dropdown */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseAlerts}
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
    </>
  );
};

export default AlertsDropdown;