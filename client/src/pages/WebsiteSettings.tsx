import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FieldProps } from "formik";
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
import DataFetchError from "../components/common/DataFetchError";
import { UpdateWebsiteUserDTO, ApiError } from "../types";

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
    ) => {
        setNotification(initialNotificationState);
        if (!numericWebsiteId) {
            setNotification({ open: true, message: "Error: Cannot save settings - Invalid Website ID.", severity: "error" });
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
             setTimeout(() => navigate(`/website/${numericWebsiteId}`), 1500);
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to update settings:", apiError);
            const message = apiError?.message || "Failed to save settings.";
            setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
    };

  
    const openDeleteDialog = useCallback(() => {
        setDeleteError(null);
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
            setNotification({ open: true, message: `Website removed successfully. Redirecting...`, severity: "success" });
            closeDeleteDialog();
             setTimeout(() => navigate("/"), 1500);
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to delete website:", apiError);
            const message = apiError.message || 'Unknown error removing website';
            setDeleteError(`Removal failed: ${message}`);
             setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
    }, [numericWebsiteId, removeWebsite, navigate, closeDeleteDialog, setNotification]);

 
    const handleBackClick = useCallback(() => {
        navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
    }, [navigate, numericWebsiteId]);

    /**
     * Handles closing of the notification snackbar.
     */
    const handleNotificationClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);

    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    if (isWebsiteLoading) {
        return <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}><Box display="flex" justifyContent="center" my={5}><CircularProgress data-testid="settings-loading-spinner" /></Box></Container>;
    }

    if (websiteError && !userWebsite) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                 <DataFetchError
                    error={websiteError as ApiError}
                    onRetry={refetchWebsite}
                    context="Website Settings"
                />
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")}>
                        Return to Dashboard
                    </Button>
                </Box>
            </Container>
        );
    }

    if (!isWebsiteLoading && !userWebsite && !websiteError) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="warning">Website not found or access denied.</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }

    if (!userWebsite) {
        return <Container sx={{ mt: 4 }}><Alert severity="info">Loading website settings...</Alert></Container>;
    }

    const deleteDialogDescription = (
        <>
            Are you sure you want to remove "{userWebsite.name || userWebsite.website?.url}"? This action cannot be undone.
            {}
            {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </>
    );

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {}
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
            {}
            <Formik initialValues={initialValues} validationSchema={WebsiteSettingsSchema} onSubmit={handleSubmit} enableReinitialize>
                {({ errors, touched, values,  dirty, isValid }) => (
                    <Form noValidate>
                        {}
                        {}
                        {}
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
                        {}
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
                        {}
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
            {}
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
            {}
            <FormNotification notification={notification} onClose={handleNotificationClose} />
        </Container>
    );
};
export default WebsiteSettings;