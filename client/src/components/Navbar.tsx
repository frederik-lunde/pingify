import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import AdbIcon from '@mui/icons-material/Adb';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import { useUserUnreadAlerts } from '../api/hooks/useAlerts';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatDistanceToNow } from 'date-fns';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { getAlertTypeColor } from '../utils/statusUtils';
import { AlertUser } from '../types';

const pages = [
  { 
    name: 'Add Website', 
    path: '/add-website',
    icon: <AddIcon fontSize="small" />,
    ariaLabel: 'Add new website to monitor' 
  },
  { 
    name: 'Export Data', 
    path: '#',
    icon: <ImportExportIcon fontSize="small" />,
    ariaLabel: 'Export monitoring data' 
  }
];

const settings = ['Profile', 'Logout'];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);
  const [anchorElNotifications, setAnchorElNotifications] = React.useState<null | HTMLElement>(null);
  
  // Use our hook with the existing parameter format
  const { 
    unreadAlerts = [], 
    loading: alertsLoading, 
    markAsRead, 
    markAllAsRead 
  } = useUserUnreadAlerts(
    50,        // limit
    undefined, // type
    undefined, // from
    undefined, // to
    false      // isResolved - only showing unresolved alerts
  );

  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNotifications(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleCloseNotifications = () => {
    setAnchorElNotifications(null);
  };

  const handlePageClick = (path: string) => {
    handleCloseNavMenu();
    navigate(path);
  };

  const handleSettingClick = async (setting: string) => {
    handleCloseUserMenu();
    if (setting === 'Logout') {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Failed to logout:', error);
      }
    }
  };

  const handleAlertClick = React.useCallback(async (alertUser: AlertUser) => {
    try {
      const alert = alertUser.alert;
      await markAsRead(alert.id);
      handleCloseNotifications();
      navigate(`/website/${alert.websiteId}`);
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }, [markAsRead, navigate, handleCloseNotifications]);

  const handleMarkAllAsRead = React.useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  }, [markAllAsRead]);

  // Count unresolved unread alerts for the badge
  const unresolvedCount = (unreadAlerts ?? []).filter(item => !item.alert.isResolved).length;

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Left side - Logo/Brand */}
          <AdbIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            PINGIFY
          </Typography>

          {/* Mobile Menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {page.icon}
                    <Typography>{page.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Mobile Logo */}
          <AdbIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h5"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            PINGIFY
          </Typography>

          {/* Desktop Navigation */}
          <Box sx={{ 
            flexGrow: 1, 
            display: { xs: 'none', md: 'flex' },
            gap: 2,
            ml: 3
          }}>
            {pages.map((page) => (
              <Tooltip key={page.name} title={page.name} arrow>
                <IconButton
                  aria-label={page.ariaLabel}
                  onClick={() => handlePageClick(page.path)}
                  color="inherit"
                  size="large"
                >
                  {page.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          {/* Right-aligned icons */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            ml: 'auto'
          }}>
            {/* Notifications - Updated with new alert functionality */}
            <Tooltip title="Alerts">
              <IconButton
                aria-label={`Show ${unresolvedCount} alerts`}
                color="inherit"
                onClick={handleOpenNotifications}
                sx={{ opacity: alertsLoading ? 0.7 : 1 }}
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

            {/* User Menu */}
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar 
                  alt={user?.name} 
                  sx={{ 
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem'
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Notifications Dropdown - Updated to use unreadAlerts */}
          <Menu
            anchorEl={anchorElNotifications}
            open={Boolean(anchorElNotifications)}
            onClose={handleCloseNotifications}
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
                disabled={(unreadAlerts ?? []).length === 0 || alertsLoading}
                sx={{
                  textTransform: 'none',
                  minWidth: 'auto'
                }}
              >
                Mark all as read
              </Button>
            </Stack>
            <Divider />
            
            {alertsLoading ? (
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

          {/* User Menu Dropdown */}
          <Menu
            sx={{ mt: '45px' }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            {settings.map((setting) => (
              <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
                <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;