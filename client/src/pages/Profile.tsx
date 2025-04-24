// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box,
    Container,
    Typography,
    TextField,
    Button, // Use standard Button
    Paper,
    Divider,
    CircularProgress,
    Alert,
    Snackbar,
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Import Grid2
import { useAuth } from '../context/AuthContext';
import {
    useUpdateUserProfileMutation,
    useUpdateUserPasswordMutation,
    useDeleteUserAccountMutation,
} from '../hooks/api/useUserMutations';
import ConfirmationDialog from '../components/common/ConfirmationDialog';

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
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // --- Mutations ---
    const updateUserProfile = useUpdateUserProfileMutation();
    const updateUserPassword = useUpdateUserPasswordMutation();
    const deleteUserAccount = useDeleteUserAccountMutation();

    // --- Formik Hooks ---
    const profileFormik = useFormik({
        initialValues: { name: '', email: '' },
        validationSchema: profileSchema,
        enableReinitialize: true,
        onSubmit: (values, { setSubmitting, resetForm }) => {
            updateUserProfile.mutate(values, {
                onSuccess: (res) => {
                    showSnackbar(res.message || 'Profile updated successfully!', 'success');
                    resetForm({ values });
                },
                onError: (error) => {
                    showSnackbar(error.message || 'Failed to update profile.', 'error');
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
            const { confirmPassword, ...payload } = values; // eslint-disable-line @typescript-eslint/no-unused-vars
            updateUserPassword.mutate(payload, {
                onSuccess: (res) => {
                    showSnackbar(res.message || 'Password updated successfully!', 'success');
                    resetForm();
                },
                onError: (error) => {
                     showSnackbar(error.message || 'Failed to update password.', 'error');
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
    }, [user]);

    // --- Handlers ---
    const handleDeleteAccount = () => {
         setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        deleteUserAccount.mutate(undefined, {
             onError: (error) => {
                showSnackbar(error.message || 'Failed to delete account.', 'error');
                setDeleteConfirmOpen(false);
            },
            // Note: onSuccess will likely log the user out via AuthContext changes,
            // so redirection might happen implicitly or need handling there.
            // onSettled might still be useful if you need cleanup regardless of outcome.
        });
    };

    const showSnackbar = (message: string, severity: "success" | "error") => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

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
                    {/* Grid container with spacing */}
                    <Grid container spacing={2}>
                        {/* Grid item - Name field */}
                        {/* Removed 'item' prop, using 'size' prop for responsiveness */}
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
                                disabled={profileFormik.isSubmitting}
                                required
                            />
                        </Grid>
                        {/* Grid item - Email field */}
                        {/* Removed 'item' prop, using 'size' prop for responsiveness */}
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
                                disabled={profileFormik.isSubmitting}
                                required
                            />
                        </Grid>
                        {/* Grid item - Submit button area */}
                         {/* Removed 'item' prop, using 'size' prop for full width */}
                        <Grid size={12}>
                            {updateUserProfile.error && (
                                <Alert severity="error" sx={{ mb: 2 }}>{updateUserProfile.error.message}</Alert>
                            )}
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!profileFormik.dirty || profileFormik.isSubmitting}
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
                     {/* Grid container with spacing */}
                    <Grid container spacing={2}>
                         {/* Grid item - Current Password field */}
                         {/* Removed 'item' prop, using 'size' prop for full width */}
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
                                disabled={passwordFormik.isSubmitting}
                                required
                            />
                        </Grid>
                         {/* Grid item - New Password field */}
                         {/* Removed 'item' prop, using 'size' prop for responsiveness */}
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
                                disabled={passwordFormik.isSubmitting}
                                required
                            />
                        </Grid>
                         {/* Grid item - Confirm Password field */}
                         {/* Removed 'item' prop, using 'size' prop for responsiveness */}
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
                                disabled={passwordFormik.isSubmitting}
                                required
                            />
                        </Grid>
                         {/* Grid item - Submit button area */}
                         {/* Removed 'item' prop, using 'size' prop for full width */}
                        <Grid size={12}>
                             {updateUserPassword.error && (
                                <Alert severity="error" sx={{ mb: 2 }}>{updateUserPassword.error.message}</Alert>
                            )}
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!passwordFormik.dirty || passwordFormik.isSubmitting}
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
             <Paper sx={{ p: 3, backgroundColor: (theme) => theme.palette.error.light + '33' /* Example lighter red */ }}>
                <Typography variant="h6" gutterBottom color="error">Danger Zone</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Deleting your account is permanent and cannot be undone. All your associated data (websites, incidents, etc.) will be removed.
                </Typography>
                 {deleteUserAccount.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{deleteUserAccount.error.message}</Alert>
                )}
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteAccount}
                    disabled={deleteUserAccount.isPending}
                    sx={{ '&.Mui-disabled': { // Optional: style disabled state if needed
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
                isLoading={deleteUserAccount.isPending} // Pass loading state
            />

            {/* Snackbar for Feedback */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default ProfilePage;