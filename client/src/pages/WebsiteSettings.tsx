// src/pages/WebsiteSettings.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers, FieldProps } from "formik";
import * as Yup from "yup";
import {
    Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
    Button, Divider, CircularProgress, Alert, IconButton, Tooltip, Stack
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
    ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";

import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks";
import FormNotification, { initialNotificationState, FormNotificationState } from "../components/common/FormNotification";
import ConfirmationDialog from "../components/common/ConfirmationDialog";
import DataFetchError from "../components/common/DataFetchError"; // Import the common error component
import { UpdateWebsiteUserDTO, ApiError } from "../types"; // Added WebsiteUser

interface WebsiteSettingsFormValues {
    name: string;
    interval: number | string;
    alertEnabled: boolean;
    alertThreshold: number | string;
    notifyEmail: string;
}

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
    const [deleteError, setDeleteError] = useState<string | null>(null);

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

    const {
        updateSettings,
        removeWebsite,
        isUpdating,
        isRemoving,
        errorUpdating,
        // errorRemoving is handled via deleteError state in the dialog
    } = useWebsiteMutations();

    const isMutating = isUpdating || isRemoving;
    const isActionLoading = isWebsiteLoading || isUpdating || isRemoving;

    const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval ?? 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        alertThreshold: userWebsite?.alertThreshold ?? "",
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]);

    const handleSubmit = async (
        values: WebsiteSettingsFormValues,
        formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
    ) => {
        const { setStatus } = formikHelpers; // Removed resetForm as navigation handles update
        setStatus(null);
        setNotification(initialNotificationState);

        if (!numericWebsiteId) {
            setStatus({ error: "Cannot save: Invalid Website ID." });
            setNotification({ open: true, message: "Error: Invalid Website ID.", severity: "error" });
            return;
        }

        const updateData: UpdateWebsiteUserDTO = {
            name: values.name.trim() || null,
            interval: Number(values.interval),
            alertEnabled: values.alertEnabled,
            alertThreshold: values.alertEnabled ? Number(values.alertThreshold) : null,
            notifyEmail: values.alertEnabled && values.notifyEmail.trim() ? values.notifyEmail.trim() : null,
        };

        try {
            await updateSettings({ websiteId: numericWebsiteId, websiteData: updateData });
            setNotification({ open: true, message: "Settings saved successfully!", severity: "success" });
            // Navigate back to details page after successful save
            navigate(`/website/${numericWebsiteId}`);
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to update settings:", apiError);
            // Use error from mutation hook if available, otherwise use the caught error
            const message = (errorUpdating as ApiError)?.message || apiError?.message || "Failed to save settings.";
            setStatus({ error: message }); // Set form-level error
            setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
        // Formik handles isSubmitting state automatically
    };

    const openDeleteDialog = useCallback(() => {
        setDeleteError(null); // Clear previous error when opening
        setDeleteConfirmOpen(true);
    }, []);

    const closeDeleteDialog = useCallback(() => {
        if (!isRemoving) {
            setDeleteConfirmOpen(false);
        }
    }, [isRemoving]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!numericWebsiteId) return;
        setDeleteError(null);
        setNotification(initialNotificationState);
        try {
            await removeWebsite(numericWebsiteId);
            setNotification({ open: true, message: `Website removed successfully.`, severity: "success" });
            closeDeleteDialog();
            navigate("/");
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to delete website:", apiError);
            const message = apiError.message || 'Unknown error removing website';
            setDeleteError(`Removal failed: ${message}`); // Set error state for the dialog
        }
    }, [numericWebsiteId, removeWebsite, navigate, closeDeleteDialog, setNotification]);

    const handleBackClick = useCallback(() => {
        navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
    }, [navigate, numericWebsiteId]);

    const handleNotificationClose = useCallback((reason?: string) => { // Added event param
        if (reason === 'clickaway') return;
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        // Handle invalid ID format in URL immediately
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }
    if (isWebsiteLoading) {
        // Show loading spinner while fetching initial data
        return <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}><Box display="flex" justifyContent="center" my={5}><CircularProgress data-testid="settings-loading-spinner" /></Box></Container>;
    }

    // Initial Load Error - Use DataFetchError
    if (websiteError && !userWebsite) {
        // Show error component if fetching failed and we have no data
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                 <DataFetchError
                    error={websiteError as ApiError}
                    onRetry={refetchWebsite} // Pass the refetch function
                    context="Website Settings"
                />
                {/* Optional: Keep a button to navigate back if error persists */}
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")}>
                        Return to Dashboard
                    </Button>
                </Box>
            </Container>
        );
    }

    // Not Found (after successful load, but no data for this ID)
    if (!isWebsiteLoading && !userWebsite && !websiteError) {
        // Show warning if loading finished, no error, but no data found
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="warning">Website not found or access denied.</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }

     // Fallback check for TypeScript (should not be reached if logic above is correct)
    if (!userWebsite) {
        return <Container sx={{ mt: 4 }}><Alert severity="info">Loading website settings...</Alert></Container>;
    }

    // Prepare description for the confirmation dialog, showing potential delete error
    const deleteDialogDescription = (
        <>
            Are you sure you want to remove "{userWebsite.name || userWebsite.website?.url}"? This action cannot be undone.
            {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </>
    );

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

            {/* Form */}
            <Formik initialValues={initialValues} validationSchema={WebsiteSettingsSchema} onSubmit={handleSubmit} enableReinitialize>
                {({ errors, touched, values, status, dirty, isValid }) => (
                    <Form noValidate>
                        {/* Form-level errors (e.g., from failed update) */}
                        {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
                        {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {(errorUpdating as ApiError).message || 'Unknown error'}</Alert>}

                        {/* General Settings Paper */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>General Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Field as={TextField} fullWidth label="Website Name" name="name"
                                        error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name}
                                        required disabled={isMutating} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Field as={TextField} fullWidth label="Check Interval (seconds)" name="interval" type="number"
                                        error={touched.interval && Boolean(errors.interval)} helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                                        required InputProps={{ inputProps: { min: 30, max: 86400, step: 30 } }} disabled={isMutating} />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Alert Settings Paper */}
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
                                <Grid container spacing={3} sx={{ mt: 0 }}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Field as={TextField} fullWidth label="Response Time Threshold (ms)" name="alertThreshold" type="number"
                                            error={touched.alertThreshold && Boolean(errors.alertThreshold)} helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (1-60000ms)"}
                                            InputProps={{ inputProps: { min: 1, max: 60000 } }} disabled={isMutating} required={values.alertEnabled} />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
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
                                disabled={isActionLoading || !dirty || !isValid}
                                data-testid="save-button">
                                {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                        </Box>
                    </Form>
                )}
            </Formik>

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteConfirmOpen}
                onClose={closeDeleteDialog}
                onConfirm={handleDeleteConfirm}
                title="Confirm Removal"
                description={deleteDialogDescription}
                confirmText="Remove"
                cancelText="Cancel"
                isLoading={isRemoving}
                confirmButtonColor="error"
            />

            {/* Snackbar Notification */}
            <FormNotification notification={notification} onClose={handleNotificationClose} />
        </Container>
    );
};

export default WebsiteSettings;