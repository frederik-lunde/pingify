// src/components/AlertsDropdown.tsx
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
// Use the refactored TanStack Query hooks
import { useUserUnreadAlertsQuery, useAlertReadMutations } from "../../hooks/api/useAlerts"; // Adjust path
import { AlertUser, AlertQueryOptions, ApiError } from "../../types"; // Added ApiError and specific types
import { getAlertTypeColor } from "../../utils/statusUtils"; // Adjust path

interface AlertsDropdownProps {
  options?: AlertQueryOptions;
  pollingInterval?: number | false; // Allow explicit false to disable polling
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({
  options = { limit: 50, isResolved: false }, // Default options
  pollingInterval = 60000, // Default polling interval (e.g., 1 minute)
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const isMenuOpen = Boolean(anchorEl);

  // --- TanStack Query Hook for fetching unread alerts (Using v5 isPending) ---
  const {
    data: unreadAlerts = [], // Default to empty array
    // Destructure isPending for the initial loading state in v5
    isPending: queryPending,
    // isFetching is true for initial load AND background refetches
    isFetching: queryFetching,
    error: queryError, // Error from the query is type ApiError | null
  } = useUserUnreadAlertsQuery(options, {
    enabled: true, // Always enabled when component is mounted
    refetchInterval: isMenuOpen ? pollingInterval : false, // Poll only when menu is open
  });

  // --- TanStack Mutation Hooks for marking alerts as read ---
  // Assuming useAlertReadMutations returns isPending for each mutation:
  const {
    markAsRead,
    markAllAsRead,
    isMarkingOne, // This should map to the first mutation's isPending
    isMarkingAll, // This should map to the second mutation's isPending
    // Optional: If you needed combined error state:
    // errorMarkingOne,
    // errorMarkingAll,
  } = useAlertReadMutations();


  // --- Combine loading states for UI ---

  // Show initial loading spinner ONLY during the very first fetch (isPending)
  // AND only if we haven't received any data yet (even an empty array).
  const showInitialSpinner = queryPending && !unreadAlerts.length;

  // Indicate background polling/refresh:
  // True if fetching is happening, but it's NOT the initial pending load.
  const isPolling = queryFetching && !queryPending;

  // Handler to open the menu
  const handleOpenAlerts = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // Handler to close the menu
  const handleCloseAlerts = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Handler for clicking an alert item
  const handleAlertClick = useCallback(
    async (alertUser: AlertUser) => {
      const websiteId = alertUser.alert?.websiteId; // Safe access
      handleCloseAlerts(); // Close menu immediately

      if (websiteId) {
          navigate(`/website/${websiteId}`);
      }
      // Marking as read handled by dismiss button
    },
    [navigate, handleCloseAlerts],
  );

  // Handler for the dismiss (mark as read) button
  const handleDismissAlert = useCallback(
    (event: React.MouseEvent, alertId: number | undefined) => { // Handle undefined alertId
      event.stopPropagation(); // Prevent menu item click
      if (alertId !== undefined) {
          markAsRead(alertId); // Call the mutation
      } else {
          console.error("Attempted to dismiss alert with undefined ID");
      }
    },
    [markAsRead],
  );

  // Handler for marking all as read
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead(); // Call the mutation
  }, [markAllAsRead]);

  // Badge count should reflect the actual number of items fetched
  const badgeCount = unreadAlerts.length;

  return (
    <>
      {/* Notifications Icon Button */}
      <Tooltip title="Alerts">
        <IconButton
          id="alerts-button" // ID for aria-controls
          aria-label={`Show ${badgeCount} alerts`}
          aria-controls={isMenuOpen ? 'alerts-menu' : undefined} // Control menu visibility
          aria-haspopup="true"
          aria-expanded={isMenuOpen ? 'true' : undefined}
          color="inherit"
          onClick={handleOpenAlerts}
          // Dim slightly during initial load OR background polling
          sx={{ opacity: (showInitialSpinner || isPolling) ? 0.7 : 1 }}
        >
          <Badge badgeContent={badgeCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notifications Dropdown Menu */}
      <Menu
        id="alerts-menu" // ID for accessibility
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseAlerts}
        PaperProps={{ sx: { maxHeight: "500px", width: "450px", overflowY: "auto", mt: 1.5 } }}
        MenuListProps={{ 'aria-labelledby': 'alerts-button' }} // Link menu to button
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Alerts</Typography>
          <Button
             size="small"
             variant="text"
             color="primary"
             onClick={handleMarkAllAsRead}
             // Disable if no alerts, or if the "mark all" mutation is pending
             disabled={unreadAlerts.length === 0 || isMarkingAll}
             sx={{ textTransform: "none", minWidth: "auto" }}
          >
            {isMarkingAll ? "Marking..." : "Mark all as read"}
          </Button>
        </Stack>
        <Divider sx={{ mb: 0.5 }} />

        {/* Body: Loading, Error, Empty, or List */}
        {showInitialSpinner ? ( // <-- Use updated variable for initial loading
          <MenuItem disabled sx={{ justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </MenuItem>
        ) : queryError ? ( // Error State
             <MenuItem disabled sx={{ justifyContent: "center", py: 2 }}>
                <Typography variant="body2" color="error" textAlign="center">
                  Error loading alerts: <br />
                  {/* Safely access error message */}
                  {(queryError as ApiError)?.message || 'Unknown error'}
                </Typography>
             </MenuItem>
        ) : unreadAlerts.length === 0 ? ( // Empty State
          <MenuItem disabled sx={{ justifyContent: "center", py: 2 }}>
            <Typography variant="body2" color="text.secondary">No new alerts</Typography>
          </MenuItem>
        ) : ( // List of Alerts
          unreadAlerts.map((alertUser, index) => { // Added index for border logic
            // Defensive coding: Ensure alert and its properties exist
            const alert = alertUser?.alert;
            if (!alert) {
              console.warn("Rendering alert item with missing alert data:", alertUser);
              return null; // Skip rendering if essential data is missing
            }

            const websiteName = alert.website?.websiteUsers?.[0]?.name || alert.website?.url || "Unknown Website";
            const alertTime = alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Unknown time';
            const alertId = alertUser.alertId; // Get alertId for dismiss action

            return (
              <MenuItem
                key={alertUser.id ?? `alert-${index}`} // Use unique ID or fallback
                onClick={() => handleAlertClick(alertUser)}
                sx={{
                  "&:hover": {
                    backgroundColor: "action.hover",
                    "& .dismiss-button": { opacity: 1 },
                  },
                  display: "flex", alignItems: "flex-start", cursor: "pointer",
                  py: 1.5, px: 2, gap: 1.5,
                  // Add bottom border for separation, except for the last item
                  borderBottom: index < unreadAlerts.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                {/* Status Icon */}
                <ListItemIcon sx={{ minWidth: "auto", mt: 0.5, mr: 1 }}>
                  <FiberManualRecordIcon
                    fontSize="small"
                    color={getAlertTypeColor(alert.type)} // Use util for color
                  />
                </ListItemIcon>

                {/* Main Content (Website Name, Message, Timestamp) */}
                <Box sx={{ flexGrow: 1, overflow: "hidden", mr: 1 }}>
                  <Typography variant="body2" fontWeight={500} noWrap title={websiteName}>
                    {websiteName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: 'normal' }}> {/* Allow message wrapping */}
                    {alert.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {alertTime}
                  </Typography>
                </Box>

                {/* Dismiss Button (Mark as Read) */}
                <Tooltip title="Mark as read">
                  {/* Disable button while marking *any* single item */}
                  <IconButton
                    aria-label="Mark as read"
                    size="small"
                    className="dismiss-button"
                    onClick={(event) => handleDismissAlert(event, alertId)} // Pass alertId
                    // Disable if the mutation for marking *one* item is pending
                    disabled={isMarkingOne}
                    sx={{
                      opacity: 0, // Hidden initially
                      transition: (theme) => theme.transitions.create("opacity"),
                      flexShrink: 0,
                      alignSelf: 'center', // Center vertically
                      ml: 'auto', // Push to the far right
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