// client/src/pages/WebsiteSettings.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
  Button, Divider, CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Use Grid v2
import {
  ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks/api/useWebsites";
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";
import { WebsiteUpdateDTO, ApiError } from "../types";

// Form values interface
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
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .min(1, "Threshold must be at least 1 millisecond")
        .max(60000, "Threshold must be at most 60000 milliseconds (1 min)")
        .required("Response threshold is required when alerts are enabled")
        .typeError("Threshold must be a number"),
      otherwise: (schema) => schema.optional().nullable(),
    }),
  notifyEmail: Yup.string()
    .email("Please enter a valid email address")
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema.required("Email is required when alerts are enabled"),
      otherwise: (schema) => schema.optional().nullable(),
    }),
});

const WebsiteSettings: React.FC = () => {
  const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();

  const numericWebsiteId = useMemo(() => {
      const id = parseInt(websiteIdParam || '', 10);
      return isNaN(id) ? undefined : id;
  }, [websiteIdParam]);

  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    data: userWebsite,
    isLoading: isWebsiteLoading,
    error: websiteError,
    refetch: refetchWebsite,
  } = useUserWebsiteQuery(numericWebsiteId, {
     enabled: !!numericWebsiteId,
     staleTime: 1000 * 60 * 5,
  });

  const {
      update: updateWebsite,
      remove: deleteWebsite,
      isUpdating,
      isDeleting,
      errorUpdating,
      // errorDeleting, // Not explicitly used for display, handled in handleDeleteConfirm
   } = useWebsiteMutations();

   const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval || 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        alertThreshold: userWebsite?.alertThreshold ?? 1000,
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]);

  const handleSubmit = async (
    values: WebsiteSettingsFormValues,
    formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
  ) => {
     const { setSubmitting, setStatus } = formikHelpers;
     setStatus({ error: null, success: null }); // Clear previous status

     if (!numericWebsiteId) {
         setStatus({ error: "Invalid Website ID."});
         setSubmitting(false);
         return;
     }

     const updateData: WebsiteUpdateDTO = {
        name: values.name.trim(),
        interval: Number(values.interval),
        alertEnabled: values.alertEnabled,
        alertThreshold: values.alertEnabled ? Number(values.alertThreshold) || null : null,
        notifyEmail: values.alertEnabled ? values.notifyEmail.trim() || null : null,
     };

     try {
        await updateWebsite({ websiteId: numericWebsiteId, websiteData: updateData });
        setStatus({ success: "Settings saved successfully!" });
        setNotification({ open: true, message: "Settings saved!", severity: "success" });
        // Optionally trigger refetch if other components depend on immediate update
        // refetchWebsite();
     } catch (err) {
        const apiError = err as ApiError;
        console.error("Failed to update settings:", apiError);
        const message = apiError.message || "Failed to save settings.";
        setStatus({ error: message });
        setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
     } finally {
        setSubmitting(false);
     }
  };

  const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteConfirmOpen(false), []);

  const handleDeleteConfirm = useCallback(async () => {
    closeDeleteDialog();
    if (!numericWebsiteId) return;

    try {
      await deleteWebsite(numericWebsiteId);
      setNotification({ open: true, message: `Website "${userWebsite?.name || 'ID: '+numericWebsiteId}" removed.`, severity: "success" });
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      const apiError = err as ApiError;
      console.error("Failed to delete website:", apiError);
      setNotification({ open: true, message: `Error removing website: ${apiError.message || 'Unknown error'}`, severity: "error" });
    }
  }, [numericWebsiteId, deleteWebsite, navigate, userWebsite?.name, closeDeleteDialog]); // Added dependencies

  const handleBackClick = useCallback(() => {
    navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
  }, [navigate, numericWebsiteId]);

  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const isLoading = isWebsiteLoading || isUpdating || isDeleting;

  // --- Render Logic ---

  if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
     return <Container sx={{mt: 4}}><Alert severity="error">Invalid Website ID provided.</Alert></Container>;
  }

  if (isWebsiteLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" my={5}><CircularProgress /></Box>
      </Container>
    );
  }

  if (websiteError) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchWebsite()}>Retry</Button>}>
          Error loading website settings: {websiteError.message}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
      </Container>
    );
  }

   if (!isWebsiteLoading && !userWebsite) {
       return (
         <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
           <Alert severity="warning">Website not found or access denied.</Alert>
           <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
         </Container>
       );
   }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Back to Website Details">
            <IconButton onClick={handleBackClick} aria-label="Back to website details">
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" component="h1">Website Settings</Typography>
        </Stack>
         <Typography variant="body2" color="textSecondary" noWrap title={userWebsite?.website?.url}>
             {userWebsite?.website?.url}
         </Typography>
      </Box>

      <Formik
        initialValues={initialValues}
        validationSchema={WebsiteSettingsSchema}
        onSubmit={handleSubmit}
        enableReinitialize // Keep form in sync with fetched data
      >
        {({ errors, touched, values, isSubmitting, status }) => (
          <Form>
            {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
            {status?.success && <Alert severity="success" sx={{ mb: 3 }}>{status.success}</Alert>}
            {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {errorUpdating.message}</Alert>}

            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}> {/* Responsive padding */}
              <Typography variant="h6" gutterBottom>General Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              {/* Grid v2 container props */}
              <Grid container spacing={3}>
                {/* Use size prop for Grid v2 item */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Website Name"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    required
                    disabled={isLoading}
                  />
                </Grid>
                {/* Use size prop for Grid v2 item */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Check Interval (seconds)"
                    name="interval"
                    type="number"
                    error={touched.interval && Boolean(errors.interval)}
                    helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                    required
                    InputProps={{ inputProps: { min: 30 } }}
                    disabled={isLoading}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}> {/* Responsive padding */}
              <Typography variant="h6" gutterBottom>Alert Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              <FormControlLabel
                control={<Field as={Switch} name="alertEnabled" color="primary" disabled={isLoading} />}
                label="Enable Alerts"
                sx={{ mb: values.alertEnabled ? 2 : 0 }} // Add margin only if fields are shown
              />
              {values.alertEnabled && (
                // Grid v2 container props
                <Grid container spacing={3}>
                  {/* Use size prop for Grid v2 item */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      label="Response Time Threshold (ms)"
                      name="alertThreshold"
                      type="number"
                      error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                      helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (ms)"}
                      InputProps={{ inputProps: { min: 1 } }}
                      disabled={isLoading}
                      required={values.alertEnabled} // Required only if alerts enabled
                    />
                  </Grid>
                   {/* Use size prop for Grid v2 item */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      label="Notification Email"
                      name="notifyEmail"
                      type="email"
                      error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                      helperText={(touched.notifyEmail && errors.notifyEmail) || "Email address for alerts"}
                      disabled={isLoading}
                      required={values.alertEnabled} // Required only if alerts enabled
                    />
                  </Grid>
                </Grid>
              )}
            </Paper>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: 'center', mt: 4, gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={openDeleteDialog}
                disabled={isLoading}
                data-testid="delete-button"
              >
                Remove Website
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={isUpdating || isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                disabled={isLoading || isSubmitting}
                data-testid="save-button"
              >
                {isUpdating || isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </Box>
          </Form>
        )}
      </Formik>

      <Dialog
        open={deleteConfirmOpen}
        onClose={closeDeleteDialog}
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
          <DialogTitle id="delete-confirm-title">Confirm Removal</DialogTitle>
          <DialogContent>
              <DialogContentText id="delete-confirm-description">
                  Are you sure you want to remove "{userWebsite?.name || userWebsite?.website?.url}"? This action cannot be undone and all associated monitoring data will be lost.
              </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
              <Button
                  onClick={handleDeleteConfirm}
                  color="error"
                  variant="contained"
                  disabled={isDeleting}
                  startIcon={isDeleting ? <CircularProgress size={16} color="inherit"/> : null}
                >
                  {isDeleting ? "Removing..." : "Remove"}
              </Button>
          </DialogActions>
      </Dialog>

      <FormNotification notification={notification} onClose={handleNotificationClose} />
    </Container>
  );
};

export default WebsiteSettings;