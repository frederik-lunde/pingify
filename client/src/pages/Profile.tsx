// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box,
    Container,
    Typography,
    TextField,
    Button,
    Paper,
    Divider,
    CircularProgress,
    Alert, // Keep Alert for deleteUserAccount error in Danger Zone if desired
    // Snackbar, // Removed Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useAuth } from '../context/AuthContext';
import {
    useUpdateUserProfileMutation,
    useUpdateUserPasswordMutation,
    useDeleteUserAccountMutation,
} from '../hooks/api/useUserMutations';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
// Import FormNotification
import FormNotification, {
    initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";

// --- Validation Schemas using Yup ---
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
    const { user, loading: authLoading } = useAuth();
    // Replace Snackbar state with FormNotification state
    const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // --- Mutations ---
    const updateUserProfile = useUpdateUserProfileMutation();
    const updateUserPassword = useUpdateUserPasswordMutation();
    const deleteUserAccount = useDeleteUserAccountMutation();

    // --- Helper to show notification ---
    const showNotification = useCallback((message: string, severity: "success" | "error") => {
        setNotification({ open: true, message, severity });
    }, []);

    // --- Formik Hooks ---
    const profileFormik = useFormik({
        initialValues: { name: '', email: '' },
        validationSchema: profileSchema,
        enableReinitialize: true,
        onSubmit: (values, { setSubmitting, resetForm }) => {
            setNotification(initialNotificationState); // Clear previous notification
            updateUserProfile.mutate(values, {
                onSuccess: (res) => {
                    showNotification(res.message || 'Profile updated successfully!', 'success');
                    resetForm({ values }); // Reset with current successful values
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
            setNotification(initialNotificationState); // Clear previous notification
            const { confirmPassword, ...payload } = values; // eslint-disable-line @typescript-eslint/no-unused-vars
            updateUserPassword.mutate(payload, {
                onSuccess: (res) => {
                    showNotification(res.message || 'Password updated successfully!', 'success');
                    resetForm(); // Reset password fields
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

    // --- Effects ---
    useEffect(() => {
        if (user) {
            profileFormik.setValues({
                name: user.name || '',
                email: user.email || '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // profileFormik is stable

    // --- Handlers ---
    const handleDeleteAccount = () => {
         setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        setNotification(initialNotificationState); // Clear previous notification
        deleteUserAccount.mutate(undefined, {
             onError: (error) => {
                showNotification(error.message || 'Failed to delete account.', 'error');
                setDeleteConfirmOpen(false); // Close dialog on error
            },
             onSuccess: () => {
                // Success notification might not be seen if logout happens immediately
                showNotification('Account deleted successfully.', 'success');
                setDeleteConfirmOpen(false);
                 // Logout is likely handled by AuthContext detecting user removal
            },
             // onSettled can be used for cleanup if needed regardless of outcome
        });
    };

    // Handle FormNotification close
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
            <Typography variant="h4" component="h1" gutterBottom>
                Profile Settings
            </Typography>

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
                             {/* Removed inline Alert for updateUserProfile.error */}
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!profileFormik.dirty || profileFormik.isSubmitting || updateUserProfile.isPending}
                                sx={{ mt: 2 }}
                            >
                                {profileFormik.isSubmitting ? <CircularProgress size={24} /> : 'Save Changes'}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Divider sx={{ my: 4 }} />

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
                              {/* Removed inline Alert for updateUserPassword.error */}
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!passwordFormik.dirty || passwordFormik.isSubmitting || updateUserPassword.isPending}
                                sx={{ mt: 2 }}
                            >
                                {passwordFormik.isSubmitting ? <CircularProgress size={24} /> : 'Update Password'}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Divider sx={{ my: 4 }} />

             {/* Delete Account Section */}
             <Paper sx={{ p: 3, backgroundColor: (theme) => theme.palette.error.light + '33' }}>
                <Typography variant="h6" gutterBottom color="error">Danger Zone</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Deleting your account is permanent and cannot be undone. All your associated data (websites, incidents, etc.) will be removed.
                </Typography>
                 {/* Optional: Keep this inline alert for context *before* clicking delete,
                     but FormNotification will show errors *after* attempting deletion. */}
                 {deleteUserAccount.error && !notification.open && (
                    <Alert severity="error" sx={{ mb: 2 }}>Failed to delete account: {deleteUserAccount.error.message}</Alert>
                )}
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteAccount}
                    disabled={deleteUserAccount.isPending}
                     sx={{ '&.Mui-disabled': {
                        backgroundColor: 'error.light',
                        cursor: 'not-allowed',
                     } }}
                >
                     {deleteUserAccount.isPending ? <CircularProgress size={24} color="inherit" /> : 'Delete My Account'}
                </Button>
            </Paper>

            {/* Confirmation Dialog for Delete */}
            <ConfirmationDialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Account Deletion"
                description={<>Are you absolutely sure you want to delete your account? This action is <strong style={{ color: 'red' }}>irreversible</strong>.</>}
                confirmText="Delete Account"
                cancelText="Cancel"
                isLoading={deleteUserAccount.isPending}
                confirmButtonColor="error" // Ensure confirm button is red
            />

             {/* FormNotification for Feedback */}
            <FormNotification
                notification={notification}
                onClose={handleNotificationClose}
             />
        </Container>
    );
};

export default ProfilePage;