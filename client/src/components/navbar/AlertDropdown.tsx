import React, { useCallback, useState } from "react";
import {
  Badge, IconButton, Tooltip, Menu, MenuItem, Stack, Typography,
  Button, Divider, ListItemIcon, Box, CircularProgress,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CloseIcon from "@mui/icons-material/Close";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
// Use the refactored TanStack Query hooks (now includes dismiss)
import { useUserUnreadAlertsQuery, useAlertActions } from "../../hooks/api/useAlerts"; // Adjust path, renamed hook
import { AlertUser, AlertQueryOptions, ApiError } from "../../types";
import { getAlertTypeColor } from "../../utils/statusUtils"; // Adjust path

interface AlertsDropdownProps {
  options?: AlertQueryOptions;
  pollingInterval?: number | false;
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({
  options = { limit: 50, isResolved: false }, // Default: fetch 50 unresolved unread alerts
  pollingInterval = 60000,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const isMenuOpen = Boolean(anchorEl);

  // --- Fetch Unread Alerts ---
  const {
    data: unreadAlerts = [],
    isPending: queryPending, // Initial load
    isFetching: queryFetching, // Background refetch or initial load
    error: queryError,
    refetch: refetchUnreadAlerts, // Function to manually refetch
  } = useUserUnreadAlertsQuery(options, {
    enabled: true,
    refetchInterval: isMenuOpen ? pollingInterval : false, // Poll only when menu is open
    // Consider adding staleTime if data doesn't need to be instantly fresh when menu reopens
    // staleTime: 1000 * 30, // e.g., 30 seconds
  });

  // --- Use Alert Action Mutations ---
  const {
    markAsRead,
    isMarkingAsRead, // Loading state for mark one read
    markAllAsRead,
    isMarkingAllAsRead, // Loading state for mark all read
    dismissAlert, // NEW: Dismiss function
    isDismissingAlert, // NEW: Loading state for dismiss
    // Combined error state (optional, handle specific errors if needed)
    // errorMarkingAsRead, errorMarkingAllAsRead, errorDismissingAlert
  } = useAlertActions(); // Use the renamed hook

  // --- Loading States for UI ---
  const showInitialSpinner = queryPending && !unreadAlerts.length;
  const isPolling = queryFetching && !queryPending;
  // Combined loading state for any action affecting a single item
  const isProcessingSingleItem = isMarkingAsRead || isDismissingAlert;


  // --- Handlers ---
  const handleOpenAlerts = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    // Optional: Trigger a refetch when opening the menu if polling is off or staleTime is used
    // if (!pollingInterval || pollingInterval === false) {
    //   refetchUnreadAlerts();
    // }
  };

  const handleCloseAlerts = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // MODIFIED: Click on alert item marks as read AND navigates
  const handleAlertClick = useCallback(
    (alertUser: AlertUser) => {
      const alertId = alertUser.alertId;
      const websiteId = alertUser.alert?.websiteId;

      handleCloseAlerts(); // Close menu

      // Mark as read (fire and forget, optimistic update handles UI)
      if (alertId !== undefined && !isProcessingSingleItem) {
         markAsRead(alertId);
      } else if(alertId === undefined) {
        console.error("Cannot mark alert as read: Missing alertId");
      }

      // Navigate if possible
      if (websiteId) {
        navigate(`/website/${websiteId}`);
      } else {
         console.warn("Cannot navigate: Missing websiteId in alert data");
      }
    },
    [navigate, handleCloseAlerts, markAsRead, isProcessingSingleItem],
  );

  // MODIFIED: Dismiss button calls the new dismissAlert mutation
  const handleDismissAlert = useCallback(
    (event: React.MouseEvent, alertId: number | undefined) => {
      event.stopPropagation(); // Prevent menu item click -> navigation/markAsRead
      if (alertId !== undefined && !isProcessingSingleItem) {
        dismissAlert(alertId); // Call the dismiss mutation
      } else if (alertId === undefined) {
          console.error("Attempted to dismiss alert with undefined ID");
      }
    },
    [dismissAlert, isProcessingSingleItem],
  );

  const handleMarkAllAsRead = useCallback(() => {
    if (!isMarkingAllAsRead) {
        markAllAsRead();
    }
  }, [markAllAsRead, isMarkingAllAsRead]);

  const badgeCount = unreadAlerts.length;

  return (
    <>
      {/* Icon Button */}
      <Tooltip title="Alerts">
        <IconButton
          id="alerts-button"
          aria-label={`Show ${badgeCount} alerts`}
          aria-controls={isMenuOpen ? 'alerts-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={isMenuOpen ? 'true' : undefined}
          color="inherit"
          onClick={handleOpenAlerts}
          sx={{ opacity: (showInitialSpinner || isPolling) ? 0.7 : 1 }}
        >
          <Badge badgeContent={badgeCount} color="error" max={99}>
            {/* Optional: Show spinner inside badge during polling? */}
            {/* {isPolling ? <CircularProgress size={10} color="inherit" /> : <NotificationsIcon />} */}
             <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Menu */}
      <Menu
        id="alerts-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseAlerts}
        PaperProps={{ sx: { maxHeight: "500px", width: "450px", overflowY: "auto", mt: 1.5 } }}
        MenuListProps={{ 'aria-labelledby': 'alerts-button' }}
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Unread Alerts</Typography>
          <Button
             size="small"
             variant="text"
             color="primary"
             onClick={handleMarkAllAsRead}
             disabled={badgeCount === 0 || isMarkingAllAsRead || isProcessingSingleItem} // Disable if actions are pending
             sx={{ textTransform: "none", minWidth: "auto" }}
          >
            {isMarkingAllAsRead ? "Marking..." : "Mark all as read"}
          </Button>
        </Stack>
        <Divider sx={{ mb: 0.5 }} />

        {/* Body */}
        {showInitialSpinner ? (
          <MenuItem disabled sx={{ justifyContent: "center", py: 4 }}><CircularProgress size={24} /></MenuItem>
        ) : queryError ? (
             <MenuItem disabled sx={{ justifyContent: "center", py: 2, whiteSpace: 'normal' }}>
                <Typography variant="body2" color="error" textAlign="center">
                  Error loading alerts: <br />
                  {(queryError as ApiError)?.message || 'Unknown error'}
                </Typography>
             </MenuItem>
        ) : badgeCount === 0 ? (
          <MenuItem disabled sx={{ justifyContent: "center", py: 2 }}>
            <Typography variant="body2" color="text.secondary">No new alerts</Typography>
          </MenuItem>
        ) : (
          // List of Alerts
          unreadAlerts.map((alertUser, index) => {
            const alert = alertUser?.alert; // Nested alert data
            if (!alert) {
              console.warn("Rendering alert item with missing nested alert data:", alertUser);
              return null; // Skip rendering if core data is missing
            }
            const alertId = alertUser.alertId; // Use alertId from AlertUser link
            if (alertId === undefined) {
                 console.warn("Rendering alert item with missing alertId:", alertUser);
                 return null;
            }

            const websiteName = alert.website?.websiteUsers?.[0]?.name || alert.website?.url || `Website ${alert.websiteId || 'N/A'}`;
            const alertTime = alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Unknown time';

            return (
              <MenuItem
                // Use a stable key combining user and alert IDs if possible, fallback to index
                key={alertUser.id ?? `alert-${alertId}-${index}`}
                // MODIFIED: Click anywhere on item marks as read + navigates
                onClick={() => handleAlertClick(alertUser)}
                sx={{
                  "&:hover": {
                    backgroundColor: "action.hover",
                    "& .dismiss-button": { opacity: 1 }, // Show dismiss button on hover
                  },
                  display: "flex", alignItems: "flex-start", cursor: "pointer",
                  py: 1.5, px: 2, gap: 1.5,
                  borderBottom: index < unreadAlerts.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  // Dim item if its specific action is pending
                  opacity: isProcessingSingleItem ? 0.6 : 1,
                  pointerEvents: isProcessingSingleItem ? 'none' : 'auto', // Prevent clicks during processing
                }}
              >
                {/* Status Icon */}
                <ListItemIcon sx={{ minWidth: "auto", mt: 0.5, mr: 1 }}>
                  <FiberManualRecordIcon
                    fontSize="small"
                    color={getAlertTypeColor(alert.type)} // Cast type if needed
                  />
                </ListItemIcon>

                {/* Main Content */}
                <Box sx={{ flexGrow: 1, overflow: "hidden", mr: 1 }}>
                  <Typography variant="body2" fontWeight={500} noWrap title={websiteName}>
                    {websiteName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: 'normal' }}>
                    {alert.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {alertTime}
                  </Typography>
                </Box>

                {/* Dismiss Button */}
                <Tooltip title="Dismiss this alert">
                  {/* Use IconButton to ensure proper spacing and click area */}
                  <IconButton
                    aria-label="Dismiss alert"
                    size="small"
                    className="dismiss-button"
                    // MODIFIED: Use specific dismiss handler
                    onClick={(event) => handleDismissAlert(event, alertId)}
                    // Disable button if *any* single item action is pending, or if mark all is pending
                    disabled={isProcessingSingleItem || isMarkingAllAsRead}
                    sx={{
                      opacity: 0, // Hidden initially, shown on hover via parent sx
                      transition: (theme) => theme.transitions.create("opacity"),
                      flexShrink: 0,
                      alignSelf: 'center',
                      ml: 'auto', // Push to the right
                      // Show spinner inside if this specific item is being dismissed
                      position: 'relative', // Needed for spinner positioning
                    }}
                  >
                     {isDismissingAlert && dismissAlert.arguments === alertId ? ( // Check if *this* item's dismiss is pending
                         <CircularProgress size={16} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-8px', marginLeft: '-8px' }} />
                     ) : (
                         <CloseIcon fontSize="inherit" />
                     )}
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