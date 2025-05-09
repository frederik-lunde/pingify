import React, { useCallback, useState, useMemo } from "react";
import {
    Badge, IconButton, Tooltip, Menu, MenuItem, Stack, Typography,
    Divider, ListItemIcon, Box, CircularProgress,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
import { useUserAlertsQuery, useAlertActions } from "../../hooks/api/useAlerts";
import { Alert, ApiError, AlertQueryOptions, AlertType, VALID_ALERT_TYPES } from "../../types";
import { getAlertTypeColor } from "../../utils/statusUtils";

interface AlertItemProps {
    alert: Alert;
    isDismissing: boolean;
    onNavigate: (websiteId: number | undefined) => void;
    onDismiss: (event: React.MouseEvent, alertId: number | undefined) => void;
    isLastItem: boolean;
}

/**
 * Renders a single alert item within the alerts dropdown.
 */
const AlertItem: React.FC<AlertItemProps> = React.memo(({
    alert,
    isDismissing,
    onNavigate,
    onDismiss,
    isLastItem
}) => {
    if (!alert?.id) return null;
    const websiteId = alert.website?.id;
    const websiteName = alert.website?.name || alert.website?.url || `Website ${alert.websiteId}`;
    const alertTime = alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Unknown time';
    const alertType = VALID_ALERT_TYPES.includes(alert.type as AlertType) ? alert.type as AlertType : undefined;
    return (
        <MenuItem
            onClick={() => onNavigate(websiteId)}
            disabled={isDismissing}
            sx={{
                display: "flex",
                alignItems: "flex-start",
                cursor: "pointer",
                py: 1.5, px: 2, gap: 1.5,
                borderBottom: !isLastItem ? '1px solid' : 'none',
                borderColor: 'divider',
                "&:hover": {
                    bgcolor: "action.hover",
                    "& .dismiss-button": { opacity: 1 },
                },
            }}
        >
            <ListItemIcon sx={{ minWidth: "auto", mt: 0.5, mr: 1 }}>
                <FiberManualRecordIcon
                    fontSize="small"
                    color={alertType ? getAlertTypeColor(alertType) : 'disabled'}
                />
            </ListItemIcon>
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
            <Tooltip title="Dismiss this alert">
                <span>
                    <IconButton
                        aria-label="Dismiss alert"
                        size="small"
                        className="dismiss-button"
                        onClick={(event) => onDismiss(event, alert.id)}
                        disabled={isDismissing}
                        sx={{
                            opacity: 0,
                            transition: (theme) => theme.transitions.create("opacity"),
                            flexShrink: 0,
                            alignSelf: 'center',
                            ml: 'auto',
                        }}
                    >
                        <CloseIcon fontSize="inherit" />
                    </IconButton>
                </span>
            </Tooltip>
        </MenuItem>
    );
});
AlertItem.displayName = 'AlertItem';

interface AlertsDropdownProps {
    apiFilters?: AlertQueryOptions;
    pollingInterval?: number | false;
    maxItems?: number;
}

/**
 * Displays a dropdown menu for active user alerts with dismiss and navigation actions.
 */
const AlertsDropdown: React.FC<AlertsDropdownProps> = ({
    apiFilters = { limit: 10 },
    pollingInterval = 60000,
    maxItems = 10,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const navigate = useNavigate();
    const isMenuOpen = Boolean(anchorEl);
    const {
        data: fetchedAlerts,
        isPending,
        isFetching,
        error: queryError,
    } = useUserAlertsQuery(
        apiFilters,
        {
            refetchInterval: isMenuOpen ? pollingInterval : false,
            staleTime: (isMenuOpen && pollingInterval) ? pollingInterval : undefined,
        }
    );
    const activeAlerts: Alert[] = useMemo(() => fetchedAlerts ?? [], [fetchedAlerts]);
    const {
        dismissAlert,
        isDismissingAlert,
    } = useAlertActions();

    const isLoading = isPending && !activeAlerts.length;
    const isPollingIndicator = isFetching && !isPending;
    const badgeCount = useMemo(() => activeAlerts.length, [activeAlerts]);
    const displayedAlerts = useMemo(() => activeAlerts.slice(0, maxItems), [activeAlerts, maxItems]);
    const hasMoreAlerts = useMemo(() => activeAlerts.length > maxItems, [activeAlerts, maxItems]);

    /**
     * Opens the alerts dropdown menu.
     */
    const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    /**
     * Closes the alerts dropdown menu.
     */
    const handleCloseMenu = useCallback(() => {
        setAnchorEl(null);
    }, []);

    /**
     * Navigates to the website associated with an alert.
     */
    const handleNavigateToWebsite = useCallback(
        (websiteId: number | undefined) => {
            handleCloseMenu();
            if (websiteId !== undefined) {
                navigate(`/website/${websiteId}`);
            } else {
                console.warn("Cannot navigate: Missing websiteId in alert data");
            }
        },
        [navigate, handleCloseMenu]
    );

    /**
     * Handles the dismissal of an alert.
     */
    const handleDismiss = useCallback(
        (event: React.MouseEvent, alertId: number | undefined) => {
            event.stopPropagation();
            if (alertId !== undefined && !isDismissingAlert) {
                dismissAlert(alertId);
            } else if (alertId === undefined) {
                console.error("Attempted to dismiss alert with undefined ID");
            }
        },
        [dismissAlert, isDismissingAlert]
    );

    /**
     * Navigates to the main alerts page.
     */
    const handleViewAllAlerts = useCallback(() => {
        handleCloseMenu();
        navigate('/alerts');
    }, [navigate, handleCloseMenu]);

    /**
     * Renders the content of the alerts menu based on current state.
     */
    const renderMenuContent = () => {
        if (isLoading) {
            return (
                <MenuItem disabled sx={{ justifyContent: "center", py: 4 }}>
                    <CircularProgress size={24} />
                </MenuItem>
            );
        }
        if (queryError) {
            return (
                 <MenuItem disabled sx={{ py: 2, whiteSpace: 'normal', cursor: 'default' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: 'error.main', width: '100%' }}>
                        <ErrorOutlineIcon />
                        <Box>
                            <Typography variant="body2" fontWeight="bold">Error Loading Alerts</Typography>
                            <Typography variant="caption">
                                {(queryError as ApiError)?.message || 'An unknown error occurred.'}
                            </Typography>
                        </Box>
                    </Stack>
                </MenuItem>
            );
        }
        if (badgeCount === 0) {
            return (
                <MenuItem disabled sx={{ py: 3, cursor: 'default' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: 'text.secondary', width: '100%', justifyContent: 'center' }}>
                        <NotificationsOffIcon />
                        <Typography variant="body2">
                            No active alerts
                        </Typography>
                    </Stack>
                </MenuItem>
            );
        }
        const menuItems = displayedAlerts.map((alert, index) => (
            <AlertItem
                key={`alert-${alert.id}`}
                alert={alert}
                isDismissing={isDismissingAlert}
                onNavigate={handleNavigateToWebsite}
                onDismiss={handleDismiss}
                isLastItem={index === displayedAlerts.length - 1 && !hasMoreAlerts}
            />
        ));
        if (hasMoreAlerts) {
             if (menuItems.length > 0) {
                 const lastItemIndex = menuItems.length - 1;
                 const lastElement = menuItems[lastItemIndex];
                 if(React.isValidElement<AlertItemProps>(lastElement)) {
                    menuItems[lastItemIndex] = React.cloneElement(lastElement, { isLastItem: false });
                 }
                menuItems.push(<Divider key="view-all-divider" />);
            }
            menuItems.push(
                <MenuItem key="view-all-link" onClick={handleViewAllAlerts} sx={{ justifyContent: 'center', py: 1.5 }}>
                    <Typography variant="body2" color="primary">
                        View All {badgeCount} Alerts
                    </Typography>
                </MenuItem>
            );
        }
        return menuItems;
    };

    return (
        <>
            <Tooltip title={badgeCount > 0 ? `${badgeCount} Active Alert${badgeCount > 1 ? 's' : ''}` : "No active alerts"}>
                <IconButton
                    id="alerts-button"
                    aria-label={`Show ${badgeCount} active alerts`}
                    aria-controls={isMenuOpen ? 'alerts-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen ? 'true' : undefined}
                    color="inherit"
                    onClick={handleOpenMenu}
                    sx={{ opacity: isPollingIndicator ? 0.7 : 1 }}
                >
                    <Badge badgeContent={badgeCount} color="error" max={99}>
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Tooltip>
            <Menu
                id="alerts-menu"
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                PaperProps={{ sx: { maxHeight: "60vh", width: "450px", overflowY: "auto", mt: 1.5, borderRadius: 2, boxShadow: 3 } }}
                MenuListProps={{ 'aria-labelledby': 'alerts-button', disablePadding: true }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                        px: 2, py: 1.5, position: "sticky", top: 0,
                        bgcolor: "background.paper", zIndex: 1,
                        borderBottom: 1, borderColor: 'divider', mb: 0.5
                    }}
                >
                    <Typography variant="subtitle1" fontWeight="bold">Active Alerts</Typography>
                    {isPollingIndicator && <CircularProgress size={20} thickness={4} sx={{ mr: 1 }}/>}
                </Stack>
                {renderMenuContent()}
            </Menu>
        </>
    );
};
export default AlertsDropdown;