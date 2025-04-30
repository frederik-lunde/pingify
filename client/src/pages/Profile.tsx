/* src/pages/ProfilePage.tsx */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router'; // Import useNavigate
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box,
    Container,
    Typography,
    TextField,
    Button,
    Paper,
    CircularProgress,
    Alert,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    Stack, // Added Stack
    IconButton, // Added IconButton
    Tooltip, // Added Tooltip
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'; // Added ArrowBackIcon
import Grid from '@mui/material/Grid2';
import { useAuth } from '../context/AuthContext';
import { useThemeMode, AppThemeMode } from '../context/ThemeContext';
import {
    useUpdateUserProfileMutation,
    useUpdateUserPasswordMutation,
    useDeleteUserAccountMutation,
} from '../hooks/api/useUserMutations';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import FormNotification, {
    initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";

// --- Validation Schemas --- (Keep as is)
const profileSchema = Yup.object({
    name: Yup.string()
        .required('Name is required')
        .max(100, 'Name too long'),
    email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
});

const passwordSchema = Yup.object({
    currentPassword: Yup.string()
        .required('Current password is required'),
    newPassword: Yup.string()
        .required('New password is required')
        .min(6, 'New password must be at least 6 characters'),
    confirmPassword: Yup.string()
        .required('Please confirm your new password')
        .oneOf([Yup.ref('newPassword')], 'New passwords must match'),
});

// --- Component ---
const ProfilePage: React.FC = () => {
    const navigate = useNavigate(); // Initialize navigate
    const auth = useAuth();
    const user = auth?.user;
    const authLoading = auth?.loading ?? true;

    const { mode: currentThemeMode, setThemeMode } = useThemeMode();
    const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const updateUserProfile = useUpdateUserProfileMutation();
    const updateUserPassword = useUpdateUserPasswordMutation();
    const deleteUserAccount = useDeleteUserAccountMutation();

    const showNotification = useCallback((message: string, severity: "success" | "error") => {
        setNotification({ open: true, message, severity });
    }, []);

    // --- Back Button Handler ---
    const handleBackClick = useCallback(() => {
        navigate('/'); // Navigate to root
    }, [navigate]);

    const profileFormik = useFormik({
        initialValues: { name: user?.name || '', email: user?.email || '' },
        validationSchema: profileSchema,
        enableReinitialize: true,
        onSubmit: (values, { setSubmitting, resetForm }) => {
            setNotification(initialNotificationState);
            updateUserProfile.mutate(values, {
                onSuccess: (res) => {
                    showNotification(res.message || 'Profile updated successfully!', 'success');
                    resetForm({ values });
                    // Potentially update user in AuthContext here if not handled automatically
                },
                onError: (error) => {
                    showNotification(error.message || 'Failed to update profile.', 'error');
                },
                onSettled: () => {
                    setSubmitting(false);
                }
            });
        },
    });

    const passwordFormik = useFormik({
        initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
        validationSchema: passwordSchema,
        onSubmit: (values, { setSubmitting, resetForm }) => {
            setNotification(initialNotificationState);
            const {...payload } = values;
            updateUserPassword.mutate(payload, {
                onSuccess: (res) => {
                    showNotification(res.message || 'Password updated successfully!', 'success');
                    resetForm();
                },
                onError: (error) => {
                     showNotification(error.message || 'Failed to update password.', 'error');
                },
                 onSettled: () => {
                    setSubmitting(false);
                }
            });
        },
    });

    const handleThemeChange = (event: SelectChangeEvent<AppThemeMode>) => {
        const newMode = event.target.value as AppThemeMode;
        setThemeMode(newMode);
    };

    const handleDeleteAccount = () => {
         setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        setNotification(initialNotificationState);
        deleteUserAccount.mutate(undefined, {
             onError: (error) => {
                showNotification(error.message || 'Failed to delete account.', 'error');
                setDeleteConfirmOpen(false);
            },
             onSuccess: () => {
                // No need for notification here as user will be logged out/redirected
                // showNotification('Account deleted successfully.', 'success');
                setDeleteConfirmOpen(false);
                // Auth context should handle logout/redirect on success
            },
        });
    };

    const handleNotificationClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);

    // --- Render ---
    if (authLoading || !user) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {/* Header with Back Button */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <Tooltip title="Back to Dashboard">
                    <IconButton onClick={handleBackClick} aria-label="Back to dashboard">
                        <ArrowBackIcon />
                    </IconButton>
                </Tooltip>
                <Typography variant="h4" component="h1" sx={{ mb: 0 /* Remove default gutterBottom */ }}>
                    Profile Settings
                </Typography>
            </Stack>

             {/* Theme Selection */}
             <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>Appearance</Typography>
                <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel id="theme-select-label">Theme</InputLabel>
                    <Select
                        labelId="theme-select-label"
                        id="theme-select"
                        value={currentThemeMode}
                        label="Theme"
                        onChange={handleThemeChange}
                    >
                        <MenuItem value={'light'}>Light</MenuItem>
                        <MenuItem value={'dark'}>Dark</MenuItem>
                        <MenuItem value={'colorblind'}>Colorblind Friendly (Dark)</MenuItem>
                    </Select>
                </FormControl>
            </Paper>

            {/* Profile Information Form */}
            <Paper sx={{ p: 3, mb: 4 }}>
                 <Typography variant="h6" gutterBottom>Account Information</Typography>
                 <Box component="form" onSubmit={profileFormik.handleSubmit} noValidate sx={{ mt: 1 }}>
                     <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                id="name"
                                name="name"
                                label="Display Name"
                                value={profileFormik.values.name}
                                onChange={profileFormik.handleChange}
                                onBlur={profileFormik.handleBlur}
                                error={profileFormik.touched.name && Boolean(profileFormik.errors.name)}
                                helperText={profileFormik.touched.name && profileFormik.errors.name}
                                disabled={profileFormik.isSubmitting || updateUserProfile.isPending}
                                required
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                fullWidth
                                id="email"
                                name="email"
                                label="Email Address"
                                type="email"
                                value={profileFormik.values.email}
                                onChange={profileFormik.handleChange}
                                onBlur={profileFormik.handleBlur}
                                error={profileFormik.touched.email && Boolean(profileFormik.errors.email)}
                                helperText={profileFormik.touched.email && profileFormik.errors.email}
                                disabled={profileFormik.isSubmitting || updateUserProfile.isPending}
                                required
                            />
                        </Grid>
                        <Grid size={12}>
                             <Button
                                type="submit"
                                variant="contained"
                                disabled={!profileFormik.dirty || !profileFormik.isValid || profileFormik.isSubmitting || updateUserProfile.isPending}
                                sx={{ mt: 2 }}
                            >
                                {profileFormik.isSubmitting || updateUserProfile.isPending ? <CircularProgress size={24} /> : 'Save Changes'}
                            </Button>
                        </Grid>
                    </Grid>
                 </Box>
            </Paper>

            {/* Change Password Form */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>Change Password</Typography>
                <Box component="form" onSubmit={passwordFormik.handleSubmit} noValidate sx={{ mt: 1 }}>
                     <Grid container spacing={2}>
                         <Grid size={12}>
                              <TextField
                                fullWidth
                                id="currentPassword"
                                name="currentPassword"
                                label="Current Password"
                                type="password"
                                value={passwordFormik.values.currentPassword}
                                onChange={passwordFormik.handleChange}
                                onBlur={passwordFormik.handleBlur}
                                error={passwordFormik.touched.currentPassword && Boolean(passwordFormik.errors.currentPassword)}
                                helperText={passwordFormik.touched.currentPassword && passwordFormik.errors.currentPassword}
                                disabled={passwordFormik.isSubmitting || updateUserPassword.isPending}
                                required
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                             <TextField
                                fullWidth
                                id="newPassword"
                                name="newPassword"
                                label="New Password"
                                type="password"
                                value={passwordFormik.values.newPassword}
                                onChange={passwordFormik.handleChange}
                                onBlur={passwordFormik.handleBlur}
                                error={passwordFormik.touched.newPassword && Boolean(passwordFormik.errors.newPassword)}
                                helperText={passwordFormik.touched.newPassword && passwordFormik.errors.newPassword}
                                disabled={passwordFormik.isSubmitting || updateUserPassword.isPending}
                                required
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                             <TextField
                                fullWidth
                                id="confirmPassword"
                                name="confirmPassword"
                                label="Confirm New Password"
                                type="password"
                                value={passwordFormik.values.confirmPassword}
                                onChange={passwordFormik.handleChange}
                                onBlur={passwordFormik.handleBlur}
                                error={passwordFormik.touched.confirmPassword && Boolean(passwordFormik.errors.confirmPassword)}
                                helperText={passwordFormik.touched.confirmPassword && passwordFormik.errors.confirmPassword}
                                disabled={passwordFormik.isSubmitting || updateUserPassword.isPending}
                                required
                            />
                        </Grid>
                        <Grid size={12}>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!passwordFormik.dirty || !passwordFormik.isValid || passwordFormik.isSubmitting || updateUserPassword.isPending}
                                sx={{ mt: 2 }}
                            >
                                {passwordFormik.isSubmitting || updateUserPassword.isPending ? <CircularProgress size={24} /> : 'Update Password'}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            {/* Delete Account Section */}
             <Paper sx={{ p: 3, backgroundColor: (theme) => theme.palette.error.light ? theme.palette.error.light + '33' : theme.palette.error.main + '33', border: (theme) => `1px solid ${theme.palette.error.main}` }}>
                <Typography variant="h6" gutterBottom color="error">Danger Zone</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Deleting your account is permanent and cannot be undone. All your associated data (websites, incidents, etc.) will be removed.
                </Typography>
                 {deleteUserAccount.error && !notification.open && (
                    <Alert severity="error" sx={{ mb: 2 }}>Failed to delete account: {deleteUserAccount.error.message}</Alert>
                )}
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteAccount}
                    disabled={deleteUserAccount.isPending}
                     sx={{ '&.Mui-disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled',
                        cursor: 'not-allowed',
                     } }}
                >
                     {deleteUserAccount.isPending ? <CircularProgress size={24} color="inherit" /> : 'Delete My Account'}
                </Button>
            </Paper>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Account Deletion"
                description={<>Are you absolutely sure you want to delete your account? This action is <strong style={{ color: 'red' }}>irreversible</strong>.</>}
                confirmText="Delete Account"
                cancelText="Cancel"
                isLoading={deleteUserAccount.isPending}
                confirmButtonColor="error"
            />

             {/* FormNotification */}
            <FormNotification
                notification={notification}
                onClose={handleNotificationClose}
             />
        </Container>
    );
};

export default ProfilePage;