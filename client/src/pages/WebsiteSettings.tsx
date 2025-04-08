// src/pages/WebsiteSettings.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
// *** Import FieldProps from formik ***
import { Formik, Form, Field, FormikHelpers, FieldProps } from "formik";
import * as Yup from "yup";
import {
    Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
    Button, Divider, CircularProgress, Alert, IconButton, Tooltip,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack
} from "@mui/material";
// Use Grid v2
import Grid from "@mui/material/Grid2";
import {
    ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";

// --- Import Hooks & Types ---
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks/api/useWebsites"; // Adjust path if needed
import FormNotification, {
    initialNotificationState, FormNotificationState
} from "../components/common/FormNotification"; // Adjust path if needed
import { UpdateWebsiteUserDTO, ApiError, WebsiteUser } from "../types"; // Adjust path if needed

interface WebsiteSettingsFormValues {
    name: string;
    interval: number | string; // Use string for input flexibility, convert on submit
    alertEnabled: boolean;
    alertThreshold: number | string; // Use string for input flexibility
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

    const {
        data: userWebsite,
        isLoading: isWebsiteLoading, // Loading initial data
        error: websiteError,
        refetch: refetchWebsite,
    } = useUserWebsiteQuery(numericWebsiteId, {
        enabled: !!numericWebsiteId,
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 5, // 5 minutes
        // refetchOnWindowFocus: false, // Optional: prevent refetch on window focus if desired
    });

    const {
        updateSettings,
        removeWebsite,
        isPending: isUpdating, // Use isPending for TanStack Query v5+
        isPending: isRemoving, // Use isPending for TanStack Query v5+
        error: errorUpdating, // Explicit error state for update
        error: errorRemoving, // Explicit error state for remove
    } = useWebsiteMutations();

    // State specifically for disabling form fields during SAVE or DELETE actions
    const isMutating = isUpdating || isRemoving;

    // State for disabling core actions (Save/Delete buttons) or showing page-level loading
    // Includes initial load AND mutations
    const isActionLoading = isWebsiteLoading || isUpdating || isRemoving;

    const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval ?? 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        alertThreshold: userWebsite?.alertThreshold === null || userWebsite?.alertThreshold === undefined
            ? ""
            : userWebsite.alertThreshold,
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]); // Recalculate when userWebsite data changes

    const handleSubmit = async (
        values: WebsiteSettingsFormValues,
        formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
    ) => {
        const { setSubmitting, setStatus, resetForm } = formikHelpers;
        setStatus({ error: null, success: null }); // Clear form status
        setNotification(initialNotificationState); // Clear snackbar

        if (!numericWebsiteId) {
            setStatus({ error: "Cannot save: Invalid Website ID." });
            setNotification({ open: true, message: "Error: Invalid Website ID.", severity: "error" });
            setSubmitting(false); // Ensure Formik knows submission stopped
            return;
        }

        // Ensure number conversion happens correctly
        const intervalNum = Number(values.interval);
        const alertThresholdNum = values.alertEnabled ? Number(values.alertThreshold) : null;

        const updateData: UpdateWebsiteUserDTO = {
            name: values.name.trim() || null,
            interval: isNaN(intervalNum) ? null : intervalNum, // Send null if somehow NaN
            alertEnabled: values.alertEnabled,
            alertThreshold: values.alertEnabled
                ? (values.alertThreshold === "" || isNaN(alertThresholdNum as number) ? null : alertThresholdNum)
                : null,
            notifyEmail: values.alertEnabled && values.notifyEmail.trim() !== ""
                ? values.notifyEmail.trim()
                : null,
        };

        // Optional: Add robust pre-submit checks even if Yup handles most cases
        if (updateData.interval === null || updateData.interval < 30 || updateData.interval > 86400) {
            setStatus({ error: "Invalid interval value (must be 30-86400)." });
            setNotification({ open: true, message: "Error: Invalid check interval.", severity: "error" });
            setSubmitting(false);
            return;
        }
        if (updateData.alertEnabled) {
             if (updateData.alertThreshold === null || updateData.alertThreshold < 1 || updateData.alertThreshold > 60000) {
                 setStatus({ error: "Invalid alert threshold value (must be 1-60000ms)." });
                 setNotification({ open: true, message: "Error: Invalid alert threshold.", severity: "error" });
                 setSubmitting(false);
                 return;
             }
             if (!updateData.notifyEmail) { // Check for null or empty string after potential trim
                 setStatus({ error: "Notification email is required when alerts are enabled." });
                 setNotification({ open: true, message: "Error: Notification email is required.", severity: "error" });
                 setSubmitting(false);
                 return;
             }
         }

        try {
            const updatedWebsite = await updateSettings({ websiteId: numericWebsiteId, websiteData: updateData });
            
            // Set success notification (Snackbar will handle showing it)
            setNotification({ open: true, message: "Settings saved successfully!", severity: "success" });

            // --- *** ADD NAVIGATION ON SUCCESS *** ---
            // Navigate back to the website detail page
            if (numericWebsiteId) {
                 // Optional: Add a small delay if you want the user to see the snackbar briefly before navigating
                 // setTimeout(() => {
                 //    navigate(`/website/${numericWebsiteId}`);
                 // }, 500); // e.g., 500ms delay

                 // Navigate immediately (recommended)
                navigate(`/website/${numericWebsiteId}`);
            }
            // --- *** END NAVIGATION *** ---


            // Note: Resetting the form might not be strictly necessary if navigating away immediately,
            // but it doesn't hurt and clears the 'dirty' state if the user navigates back quickly.
            resetForm({
                values: {
                    name: updatedWebsite?.name || "",
                    interval: updatedWebsite?.interval ?? 300,
                    alertEnabled: updatedWebsite?.alertEnabled ?? false,
                    alertThreshold: updatedWebsite?.alertThreshold ?? "",
                    notifyEmail: updatedWebsite?.notifyEmail || "",
                }
            });

        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to update settings:", apiError);
            // Prioritize mutation error state, then caught error
            const message = (errorUpdating as ApiError)?.message || apiError?.message || "Failed to save settings.";
            setStatus({ error: message });
            setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
        // No finally { setSubmitting(false) } needed for Formik v2+ with async onSubmit
    };

    const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
    const closeDeleteDialog = useCallback(() => {
        // Only allow closing if not actively removing
        if (!isRemoving) {
            setDeleteConfirmOpen(false);
        }
    }, [isRemoving]); // Depend on isRemoving

    const handleDeleteConfirm = useCallback(async () => {
        if (!numericWebsiteId) return;

        try {
            await removeWebsite(numericWebsiteId);
            // Success notification
            setNotification({ open: true, message: `Website "${userWebsite?.name || userWebsite?.website?.url || 'ID: ' + numericWebsiteId}" removed successfully.`, severity: "success" });
            closeDeleteDialog(); // Close dialog on success
            navigate("/"); // Redirect to dashboard after successful delete
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to delete website:", apiError);
            // Prioritize mutation error state, then caught error
            const message = (errorRemoving as ApiError)?.message || apiError.message || 'Unknown error removing website';
            setNotification({ open: true, message: `Error removing website: ${message}`, severity: "error" });
            // Keep dialog open on error? Or close? Current: stays open.
        }
    }, [numericWebsiteId, removeWebsite, navigate, userWebsite?.name, userWebsite?.website?.url, closeDeleteDialog, errorRemoving, setNotification]); // Added dependencies

    const handleBackClick = useCallback(() => {
        // Navigate back to detail page if ID exists, otherwise dashboard
        navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
    }, [navigate, numericWebsiteId]);

    const handleNotificationClose = useCallback(() => {
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);


    // --- Render Logic ---

    // Handle Invalid ID Param State
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    // Show loading spinner ONLY during the initial website data fetch
    if (isWebsiteLoading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center" my={5}><CircularProgress data-testid="settings-loading-spinner" /></Box>
            </Container>
        );
    }

    // Handle Query Error State (after initial load attempt)
    if (websiteError) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchWebsite()}>Retry</Button>}>
                    Error loading website settings: {(websiteError as ApiError).message || 'Unknown error'}
                </Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>
                    Return to Dashboard
                </Button>
            </Container>
        );
    }

    // Handle Case where website query succeeded but returned no data (404, permissions etc)
    if (!userWebsite) { // No need for !isWebsiteLoading check here, as loading state is handled above
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="warning">Website not found or access denied.</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>
                    Return to Dashboard
                </Button>
            </Container>
        );
    }

    // --- Main Render ---
    // Now we know data has loaded (or failed, handled above), and userWebsite exists.
    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Back to Website Details">
                        {/* Disable back button only during mutation */}
                        <IconButton onClick={handleBackClick} aria-label="Back to website details" disabled={isMutating}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h4" component="h1">
                        Website Settings
                    </Typography>
                </Stack>
                <Typography variant="body2" color="textSecondary" noWrap title={userWebsite.website?.url ?? ''} sx={{ maxWidth: '50%', textAlign: 'right' }}>
                    {userWebsite.website?.url ?? 'URL not available'}
                </Typography>
            </Box>

            <Formik
                initialValues={initialValues}
                validationSchema={WebsiteSettingsSchema}
                onSubmit={handleSubmit}
                enableReinitialize // Important to update form when initialValues change after load or save
            >
                {/* Destructure necessary props from Formik state */}
                {({ errors, touched, values, isSubmitting, status, dirty, isValid }) => (
                    <Form noValidate>
                        {/* Form-level status/error messages */}
                        {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
                        {/* Display mutation error if form status doesn't have one */}
                        {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {(errorUpdating as ApiError).message || 'Unknown error'}</Alert>}

                        {/* General Settings Paper */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>General Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Grid container spacing={3}>
                                <Grid xs={12} md={6}>
                                    <Field
                                        as={TextField}
                                        fullWidth
                                        label="Website Name"
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        required
                                        disabled={isMutating} // Disable only during save/delete
                                    />
                                </Grid>
                                <Grid xs={12} md={6}>
                                    <Field
                                        as={TextField}
                                        fullWidth
                                        label="Check Interval (seconds)"
                                        name="interval"
                                        type="number"
                                        error={touched.interval && Boolean(errors.interval)}
                                        helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                                        required
                                        InputProps={{ inputProps: { min: 30, max: 86400, step: 30 } }}
                                        disabled={isMutating} // Disable only during save/delete
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Alert Settings Paper */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                            <Divider sx={{ mb: 3 }} />

                            {/* --- *** FIELD RENDER PROP FOR SWITCH *** --- */}
                            <Field name="alertEnabled" type="checkbox">
                                {({ field }: FieldProps<boolean>) => (
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                {...field} // Passes necessary props like onChange, onBlur
                                                checked={field.value} // *** Explicitly set checked state from Formik's value ***
                                                color="primary"
                                                disabled={isMutating} // Use the correct disabled state
                                            />
                                        }
                                        label="Enable Downtime / Slow Response Alerts"
                                        // Use 'values' from the outer Formik scope for conditional styling
                                        sx={{ mb: values.alertEnabled ? 2 : 0 }}
                                    />
                                )}
                            </Field>
                            {/* --- *** END FIELD RENDER PROP *** --- */}


                            {/* Conditional Alert Fields - Show/hide based on Formik's 'values' */}
                            {values.alertEnabled && (
                                <Grid container spacing={3} sx={{ mt: 0 }}> {/* Adjust margin if needed */}
                                    <Grid xs={12} md={6}>
                                        <Field
                                            as={TextField}
                                            fullWidth
                                            label="Response Time Threshold (ms)"
                                            name="alertThreshold"
                                            type="number"
                                            error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                                            helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (1-60000ms)"}
                                            InputProps={{ inputProps: { min: 1, max: 60000 } }}
                                            disabled={isMutating} // Disable only during save/delete
                                            required={values.alertEnabled} // Required is conditional
                                        />
                                    </Grid>
                                    <Grid xs={12} md={6}>
                                        <Field
                                            as={TextField}
                                            fullWidth
                                            label="Notification Email"
                                            name="notifyEmail"
                                            type="email"
                                            error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                                            helperText={(touched.notifyEmail && errors.notifyEmail) || "Email address for alerts"}
                                            disabled={isMutating} // Disable only during save/delete
                                            required={values.alertEnabled} // Required is conditional
                                        />
                                    </Grid>
                                </Grid>
                            )}
                        </Paper>

                        {/* Action Buttons */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: 'center', mt: 4, gap: 2, flexWrap: 'wrap' }}>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={openDeleteDialog}
                                // Disable button during ANY loading action (initial or mutation)
                                disabled={isActionLoading}
                                data-testid="delete-button"
                            >
                                Remove Website
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                // Show spinner only when updating
                                startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                // Disable button if:
                                // - Any action is loading (initial fetch, update, remove)
                                // - Formik is submitting (safety check, often covered by isUpdating)
                                // - Form is unchanged (not dirty)
                                // - Form is invalid
                                disabled={isActionLoading || isSubmitting || !dirty || !isValid}
                                data-testid="save-button"
                            >
                                {isUpdating ? "Saving..." : "Save Changes"} {/* Text reflects update state */}
                            </Button>
                        </Box>
                    </Form>
                )}
            </Formik>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={closeDeleteDialog} // Use the guarded close handler
                aria-labelledby="delete-confirm-title"
                aria-describedby="delete-confirm-description"
            >
                <DialogTitle id="delete-confirm-title">Confirm Removal</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-confirm-description">
                        Are you sure you want to remove "{userWebsite.name || userWebsite.website?.url}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    {/* Disable Cancel only when removal is actively processing */}
                    <Button onClick={closeDeleteDialog} disabled={isRemoving}>Cancel</Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={isRemoving} // Disable only when removal is actively processing
                        startIcon={isRemoving ? <CircularProgress size={16} color="inherit" /> : null}
                        data-testid="confirm-delete-button"
                    >
                        {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar Notification */}
        </Container>
    );
};

export default WebsiteSettings;