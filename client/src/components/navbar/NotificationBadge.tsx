import React, { useState } from 'react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Tooltip from '@mui/material/Tooltip';
import { useUserUnreadAlerts } from '../../api/hooks/useAlerts';
import NotificationMenu from './NotificationMenu';

const NotificationBadge: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Use hook to get count of unresolved, unread alerts
  const { unreadAlerts = [], loading } = useUserUnreadAlerts(
    undefined, 
    undefined, 
    undefined, 
    undefined, 
    false // Only unresolved alerts
  );
  
  // Only count unresolved alerts for the badge
  const unresolvedCount = (unreadAlerts || []).filter(item => !item.alert.isResolved).length;
  
  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseNotifications = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Alerts">
        <IconButton
          aria-label={`Show ${unresolvedCount} alerts`}
          color="inherit"
          onClick={handleOpenNotifications}
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
      
      <NotificationMenu 
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseNotifications}
      />
    </>
  );
};

export default NotificationBadge;