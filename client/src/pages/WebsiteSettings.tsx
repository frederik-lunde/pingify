/*
src/pages/WebsiteSettings.tsx
*/
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers, FieldProps } from "formik";
import * as Yup from "yup";
import {
    Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
    Button, Divider, CircularProgress, Alert, IconButton, Tooltip,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // <-- Use Grid v2
import {
    ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";

// Adjust paths as needed
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks";
import FormNotification, { initialNotificationState, FormNotificationState } from "../components/common/FormNotification";
import { UpdateWebsiteUserDTO, ApiError, WebsiteUser } from "../types";

interface WebsiteSettingsFormValues {
    name: string;
    interval: number | string;
    alertEnabled: boolean;
    alertThreshold: number | string;
    notifyEmail: string;
}

// Validation schema using Yup
const WebsiteSettingsSchema = Yup.object().shape({
    name: Yup.string().trim().required("Website name is required"),
    interval: Yup.number()
        .min(30, "Interval must be at least 30 seconds")
        .max(86400, "Interval must be at most 86400 seconds (1 day)")
        .required("Interval is required")
        .typeError("Interval must be a number"),
    alertEnabled: Yup.boolean().required(),
    alertThreshold: Yup.number()
        .when("alertEnabled", ([alertEnabled], schema) => {
            return alertEnabled
                ? schema
                    .min(1, "Threshold must be at least 1 millisecond")
                    .max(60000, "Threshold must be at most 60000 milliseconds (1 min)")
                    .required("Response threshold is required when alerts are enabled")
                    .typeError("Threshold must be a number")
                : schema.nullable().transform((value) => (value === "" || value == null) ? null : value);
        }),
    notifyEmail: Yup.string()
        .email("Please enter a valid email address")
        .when("alertEnabled", ([alertEnabled], schema) => {
            return alertEnabled
                ? schema.trim().required("Email is required when alerts are enabled")
                : schema.nullable().email("Please enter a valid email address").transform((value) => (value === "" || value == null) ? null : value.trim());
        }),
});


const WebsiteSettings: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const parseIdParam = (idParam: string | undefined): number | undefined => {
        if (!idParam) return undefined;
        const id = parseInt(idParam, 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    };

    const numericWebsiteId = useMemo(() => parseIdParam(websiteIdParam), [websiteIdParam]);

    const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // --- Data Fetching ---
    const {
        data: userWebsite,
        isLoading: isWebsiteLoading,
        error: websiteError,
        refetch: refetchWebsite,
    } = useUserWebsiteQuery(numericWebsiteId, {
        enabled: !!numericWebsiteId,
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
    });

    // --- Mutations ---
    const {
        updateSettings,
        removeWebsite,
        isUpdating,
        isRemoving,
        errorUpdating,
        errorRemoving,
    } = useWebsiteMutations();

    // Combined state for disabling form fields during any mutation
    const isMutating = isUpdating || isRemoving;
    // Combined state for disabling core actions (Save/Delete buttons) or showing page-level loading
    const isActionLoading = isWebsiteLoading || isUpdating || isRemoving;

    // --- Form Initial Values ---
    const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval ?? 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        alertThreshold: userWebsite?.alertThreshold ?? "",
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]);

    // --- Handlers ---
    const handleSubmit = async (
        values: WebsiteSettingsFormValues,
        formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
    ) => {
        const { setStatus, resetForm } = formikHelpers;
        setStatus(null); // Clear previous form status
        setNotification(initialNotificationState);

        if (!numericWebsiteId) {
            setStatus({ error: "Cannot save: Invalid Website ID." });
            setNotification({ open: true, message: "Error: Invalid Website ID.", severity: "error" });
            return;
        }

        // Prepare DTO, relying on Yup for validation before this point
        const updateData: UpdateWebsiteUserDTO = {
            name: values.name.trim() || null,
            interval: Number(values.interval), // Yup ensures this is a valid number
            alertEnabled: values.alertEnabled,
            // Convert threshold/email based on alertEnabled status
            alertThreshold: values.alertEnabled ? Number(values.alertThreshold) : null, // Yup ensures number if enabled
            notifyEmail: values.alertEnabled && values.notifyEmail.trim() ? values.notifyEmail.trim() : null,
        };

        try {
            const updatedWebsite = await updateSettings({ websiteId: numericWebsiteId, websiteData: updateData });
            setNotification({ open: true, message: "Settings saved successfully!", severity: "success" });

            // Navigate back only after successful save
            navigate(`/website/${numericWebsiteId}`);

            // Optionally reset form to reflect saved state if staying on page
            // resetForm({ values: { /* map updatedWebsite back to form values */ } });

        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to update settings:", apiError);
            const message = (errorUpdating as ApiError)?.message || apiError?.message || "Failed to save settings.";
            setStatus({ error: message }); // Set form-level error
            setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
        // Formik handles isSubmitting state automatically with async onSubmit
    };

    const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
    const closeDeleteDialog = useCallback(() => { if (!isRemoving) setDeleteConfirmOpen(false); }, [isRemoving]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!numericWebsiteId) return;
        setNotification(initialNotificationState);
        try {
            await removeWebsite(numericWebsiteId);
            setNotification({ open: true, message: `Website removed successfully.`, severity: "success" });
            closeDeleteDialog();
            navigate("/");
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to delete website:", apiError);
            const message = (errorRemoving as ApiError)?.message || apiError.message || 'Unknown error removing website';
            setNotification({ open: true, message: `Error removing website: ${message}`, severity: "error" });
            // Keep dialog open on error
        }
    }, [numericWebsiteId, removeWebsite, navigate, closeDeleteDialog, errorRemoving, setNotification]);

    const handleBackClick = useCallback(() => {
        navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
    }, [navigate, numericWebsiteId]);

    const handleNotificationClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
         if (reason === 'clickaway') return;
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }
    if (isWebsiteLoading) {
        return <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}><Box display="flex" justifyContent="center" my={5}><CircularProgress data-testid="settings-loading-spinner" /></Box></Container>;
    }
    if (websiteError) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchWebsite()}>Retry</Button>}>
                    Error loading website settings: {(websiteError as ApiError).message || 'Unknown error'}
                </Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }
    if (!userWebsite) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="warning">Website not found or access denied.</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Back to Website Details">
                        <IconButton onClick={handleBackClick} aria-label="Back to website details" disabled={isMutating}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h4" component="h1">Website Settings</Typography>
                </Stack>
                <Typography variant="body2" color="textSecondary" noWrap title={userWebsite.website?.url ?? ''} sx={{ maxWidth: '50%', textAlign: 'right' }}>
                    {userWebsite.website?.url ?? 'URL not available'}
                </Typography>
            </Box>

            <Formik initialValues={initialValues} validationSchema={WebsiteSettingsSchema} onSubmit={handleSubmit} enableReinitialize>
                {({ errors, touched, values, status, dirty, isValid }) => (
                    <Form noValidate>
                        {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
                        {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {(errorUpdating as ApiError).message || 'Unknown error'}</Alert>}

                        {/* General Settings */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>General Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            {/* Use Grid v2 */}
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                    <Field as={TextField} fullWidth label="Website Name" name="name"
                                        error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name}
                                        required disabled={isMutating} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                    <Field as={TextField} fullWidth label="Check Interval (seconds)" name="interval" type="number"
                                        error={touched.interval && Boolean(errors.interval)} helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                                        required InputProps={{ inputProps: { min: 30, max: 86400, step: 30 } }} disabled={isMutating} />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Alert Settings */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Field name="alertEnabled" type="checkbox">
                                {({ field }: FieldProps<boolean>) => (
                                    <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" disabled={isMutating} />}
                                        label="Enable Downtime / Slow Response Alerts" sx={{ mb: values.alertEnabled ? 2 : 0 }} />
                                )}
                            </Field>
                            {values.alertEnabled && (
                                // Use Grid v2
                                <Grid container spacing={3} sx={{ mt: 0 }}>
                                    <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                        <Field as={TextField} fullWidth label="Response Time Threshold (ms)" name="alertThreshold" type="number"
                                            error={touched.alertThreshold && Boolean(errors.alertThreshold)} helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (1-60000ms)"}
                                            InputProps={{ inputProps: { min: 1, max: 60000 } }} disabled={isMutating} required={values.alertEnabled} />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                        <Field as={TextField} fullWidth label="Notification Email" name="notifyEmail" type="email"
                                            error={touched.notifyEmail && Boolean(errors.notifyEmail)} helperText={(touched.notifyEmail && errors.notifyEmail) || "Email address for alerts"}
                                            disabled={isMutating} required={values.alertEnabled} />
                                    </Grid>
                                </Grid>
                            )}
                        </Paper>

                        {/* Action Buttons */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: 'center', mt: 4, gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={openDeleteDialog}
                                disabled={isActionLoading} data-testid="delete-button">
                                Remove Website
                            </Button>
                            <Button type="submit" variant="contained" startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                // Simplified disabled logic
                                disabled={isActionLoading || !dirty || !isValid}
                                data-testid="save-button">
                                {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                        </Box>
                    </Form>
                )}
            </Formik>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={closeDeleteDialog} aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
                <DialogTitle id="delete-confirm-title">Confirm Removal</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-confirm-description">
                        Are you sure you want to remove "{userWebsite.name || userWebsite.website?.url}"? This action cannot be undone.
                    </DialogContentText>
                    {errorRemoving && <Alert severity="error" sx={{ mt: 2 }}>Removal failed: {(errorRemoving as ApiError).message || 'Unknown error'}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeDeleteDialog} disabled={isRemoving}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isRemoving}
                        startIcon={isRemoving ? <CircularProgress size={16} color="inherit" /> : null} data-testid="confirm-delete-button">
                        {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar Notification */}
            <FormNotification notification={notification} onClose={handleNotificationClose} />
        </Container>
    );
};

export default WebsiteSettings;