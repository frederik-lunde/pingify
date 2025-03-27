// src/components/AlertsDropdown.tsx
import React, { useCallback, useState } from 'react'; // Added useState
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
import CloseIcon from '@mui/icons-material/Close'; 
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router';
import { useUserUnreadAlerts } from '../../hooks'; // Ensure correct path
import { AlertUser, AlertQueryOptions } from '../../types';
import { getAlertTypeColor } from '../../utils/statusUtils';

interface AlertsDropdownProps {
  options?: AlertQueryOptions;
  pollingInterval?: number;
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({ 
  options = { limit: 50, isResolved: false },
  pollingInterval,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();

  const isMenuOpen = Boolean(anchorEl);

  const { 
    unreadAlerts = [], 
    loading, 
    markAsRead, 
    markAllAsRead 
  } = useUserUnreadAlerts(options, pollingInterval, isMenuOpen);

  // Handler to open the menu
  const handleOpenAlerts = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseAlerts = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleAlertClick = useCallback(async (alertUser: AlertUser) => {
    const websiteId = alertUser.alert.websiteId;
    try {
      handleCloseAlerts();

      if (!websiteId) {
        return; 
      }

      navigate(`/website/${websiteId}`);

    } catch (error) {
      console.error('Failed to mark alert as read and navigate:', error);
    }
  }, [navigate, handleCloseAlerts]);

  const handleDismissAlert = useCallback(async (event: React.MouseEvent, alertId: number) => {
    event.stopPropagation();
    try {
      await markAsRead(alertId); 
    } catch (error) {
      console.error('Failed to mark single alert as read:', error);
    }
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  }, [markAllAsRead]);

  const unresolvedCount = (unreadAlerts ?? []).filter(item => !item.alert.isResolved).length;

  return (
    <>
      {/* Notifications Icon Button with Badge */}
      <Tooltip title="Alerts">
        <IconButton
          aria-label={`Show ${unresolvedCount} alerts`}
          color="inherit"
          onClick={handleOpenAlerts}
          sx={{ opacity: loading && !isMenuOpen ? 0.7 : 1 }} 
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

      {/* Notifications Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen} // Controlled by state
        onClose={handleCloseAlerts} // Handler to close
        PaperProps={{
          sx: {
            maxHeight: '500px', // Increased size
            width: '450px',   // Increased size
            overflowY: 'auto', // Ensure scrolling if content exceeds maxHeight
            mt: 1.5, // Add some margin-top from the icon
          }
        }}

      >
        {/* Header Section */}
        <Stack 
            direction="row" 
            justifyContent="space-between" 
            alignItems="center" 
            sx={{ px: 2, py: 1, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }} // Sticky header
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Alerts
          </Typography>
          <Button 
            size="small"
            variant="text"
            color="primary"
            onClick={handleMarkAllAsRead}
            disabled={(unreadAlerts ?? []).length === 0 || (loading && unreadAlerts.length === 0)} 
            sx={{
              textTransform: 'none',
              minWidth: 'auto'
            }}
          >
            Mark all as read
          </Button>
        </Stack>
        <Divider sx={{ mb: 0.5 }} />
        
        {/* Body Section: Loading, Empty, or List */}
        {/* Show loading indicator only if menu is open and loading is true */}
        {loading && isMenuOpen && unreadAlerts.length === 0 ? ( 
          <MenuItem disabled sx={{ justifyContent: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Loading alerts...
            </Typography>
          </MenuItem>
        // Show empty message if not loading and no alerts
        ) : !loading && (unreadAlerts ?? []).length === 0 ? ( 
          <MenuItem disabled sx={{ justifyContent: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No new alerts
            </Typography>
          </MenuItem>
        // Render the list of alerts
        ) : (
          (unreadAlerts ?? []).map((alertUser) => {
            const alert = alertUser.alert;
            const websiteName = alert.website?.websiteUsers?.[0]?.name || alert.website?.url || 'Unknown Website';
            
            return (
              <MenuItem
                key={alertUser.id} // Use AlertUser ID as key
                // Attach navigation click to the main item
                onClick={() => handleAlertClick(alertUser)}
                sx={{
                  // Slight background for unread items?
                  // bgcolor: !alertUser.isRead ? 'action.hover' : 'inherit', 
                  '&:hover': {
                    backgroundColor: 'action.selected',
                    // Target the dismiss button on hover
                    '& .dismiss-button': {
                      opacity: 1,
                    }
                  },
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start', // Align items top when text wraps
                  cursor: 'pointer',
                  py: 1.5, // Add padding
                  px: 2,   // Add padding
                  gap: 1, // Add gap between elements
                }}
              >
                {/* Status Icon */}
                <ListItemIcon sx={{ minWidth: 'auto', mt: 0.5 }}> 
                  <FiberManualRecordIcon
                    fontSize="small"
                    color={getAlertTypeColor(alert.type)}
                  />
                </ListItemIcon>

                {/* Main Content Area (Text + Timestamp) */}
                <Box sx={{ flexGrow: 1, overflow: 'hidden', mr: 1 }}>
                  <Typography variant="body2" fontWeight={500} noWrap title={websiteName}> 
                    {websiteName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} /* Allow wrapping */>
                    {alert.message}
                  </Typography>
                   <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </Typography>
                </Box>

                {/* Dismiss Button */}
                <Tooltip title="Mark as read">
                    <IconButton
                        aria-label="Mark as read"
                        size="small"
                        className="dismiss-button" // Class name for hover targeting
                        onClick={(event) => handleDismissAlert(event, alert.id)}
                        sx={{
                            opacity: 0, // Initially hidden
                            transition: (theme) => theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest }),
                            flexShrink: 0, // Prevent shrinking
                            zIndex: 1, // Ensure clickable
                            alignSelf: 'center', // Center vertically relative to the item
                        }}
                    >
                        <CloseIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
};

export default AlertsDropdown;