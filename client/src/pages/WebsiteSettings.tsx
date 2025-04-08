// src/pages/WebsiteSettings.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
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
// Adjust path
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks/api/useWebsites";
// Adjust path
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";
// Adjust path
import { UpdateWebsiteUserDTO, ApiError, WebsiteUser } from "../types";

// Form values interface
interface WebsiteSettingsFormValues {
  name: string;
  // Allow string for initial input flexibility
  interval: number | string;
  alertEnabled: boolean;
  // Allow string for initial input flexibility
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
    // Error message if not a number
    .typeError("Interval must be a number"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
     // Use array destructuring for Yup v1+
     .when("alertEnabled", ([alertEnabled], schema) => {
         return alertEnabled
             ? schema
                 .min(1, "Threshold must be at least 1 millisecond")
                 .max(60000, "Threshold must be at most 60000 milliseconds (1 min)")
                 .required("Response threshold is required when alerts are enabled")
                 // Error message if not a number
                 .typeError("Threshold must be a number")
             // Allow null/empty when disabled
             : schema.optional().nullable();
     }),
  notifyEmail: Yup.string()
    .email("Please enter a valid email address")
     // Use array destructuring for Yup v1+
     .when("alertEnabled", ([alertEnabled], schema) => {
         return alertEnabled
             ? schema.required("Email is required when alerts are enabled")
             // Allow null/empty when disabled
             : schema.optional().nullable();
     }),
});


const WebsiteSettings: React.FC = () => {
  const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();

  // Helper for parsing ID - Returns number or undefined
  const parseIdParam = (idParam: string | undefined): number | undefined => {
      if (!idParam) return undefined;
      const id = parseInt(idParam, 10);
      return isNaN(id) || id <= 0 ? undefined : id;
  };

  // Memoize the parsed ID (will be number | undefined)
  const numericWebsiteId = useMemo(() => parseIdParam(websiteIdParam), [websiteIdParam]);

  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Fetch query for initial data - Pass number | undefined
  const {
    // Type is WebsiteUser | undefined based on query return
    data: userWebsite,
    isLoading: isWebsiteLoading,
    error: websiteError,
    refetch: refetchWebsite,
  } = useUserWebsiteQuery(numericWebsiteId, {
     // Enable only if ID is a valid number
     enabled: !!numericWebsiteId,
     // Example: Keep data fresh for 1 minute
     staleTime: 1000 * 60 * 1,
     // Example: Keep data in cache for 5 minutes
     gcTime: 1000 * 60 * 5,
  });

  // Use refactored hook names
  const {
      updateSettings,
      removeWebsite,
      isUpdating,
      isRemoving,
      errorUpdating,
      errorRemoving,
   } = useWebsiteMutations();

   // Derive initial form values from fetched data
   // Use optional chaining and nullish coalescing for safety
   const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval ?? 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        // Default to empty string if threshold is null/undefined for the input field
        alertThreshold: userWebsite?.alertThreshold === null || userWebsite?.alertThreshold === undefined
            ? ""
            : userWebsite.alertThreshold,
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]); // Recalculate when userWebsite data changes

  // --- Handlers ---
  const handleSubmit = async (
    values: WebsiteSettingsFormValues,
    formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
  ) => {
     const { setSubmitting, setStatus } = formikHelpers;
     // Clear previous form status
     setStatus({ error: null, success: null });
     // Clear previous snackbar notification
     setNotification(initialNotificationState);

     // Re-check ID validity before submitting
     if (!numericWebsiteId) {
         setStatus({ error: "Cannot save: Invalid Website ID."});
         setNotification({ open: true, message: "Error: Invalid Website ID.", severity: "error" });
         // Important to stop Formik submission
         setSubmitting(false);
         return;
     }

     // Prepare DTO for the update mutation
     const updateData: UpdateWebsiteUserDTO = {
        // Send null if empty string after trim
        name: values.name.trim() || null,
        // Convert (Yup already validated type)
        interval: Number(values.interval),
        alertEnabled: values.alertEnabled,
        // Convert "" or non-number input to null if alerts enabled, otherwise always null
        alertThreshold: values.alertEnabled
            ? (values.alertThreshold === "" || isNaN(Number(values.alertThreshold)) ? null : Number(values.alertThreshold))
            : null,
        // Send null if empty string after trim or if alerts disabled
        notifyEmail: values.alertEnabled && values.notifyEmail.trim() !== ""
            ? values.notifyEmail.trim()
            : null,
     };

     // --- Refined Pre-submit Validation ---
     // Validate Interval (Yup handles type, check range)
     if (isNaN(updateData.interval!) || updateData.interval! < 30) {
          setStatus({ error: "Invalid interval value (must be >= 30)." });
         setNotification({ open: true, message: "Error: Invalid check interval.", severity: "error" });
         setSubmitting(false);
         return;
     }
     // Validate Alert Threshold & Email only if alerts are enabled
     if (updateData.alertEnabled) {
         // Type is number | null
         const thresholdNum = updateData.alertThreshold;

         // FIX: Check for null/undefined first, then check if it's a valid number >= 1
         if (thresholdNum === null || thresholdNum === undefined || thresholdNum < 1) {
             setStatus({ error: "Invalid alert threshold value (must be >= 1ms)." });
             setNotification({ open: true, message: "Error: Invalid alert threshold.", severity: "error" });
             setSubmitting(false);
             return;
         }
         // Validate Email
         // Check if email ended up null
         if (updateData.notifyEmail === null) {
             setStatus({ error: "Notification email is required when alerts are enabled." });
             setNotification({ open: true, message: "Error: Notification email is required.", severity: "error" });
             setSubmitting(false);
             return;
         }
     }
     // --- End Refined Pre-submit Validation ---


     try {
        // Call the renamed update mutation function
        await updateSettings({ websiteId: numericWebsiteId, websiteData: updateData });
        // Use snackbar for success feedback, not form status
        setNotification({ open: true, message: "Settings saved successfully!", severity: "success" });
        // setQueryData in the hook should update cache, refetch might not be needed immediately
        // Consider if a full refetch is desired: refetchWebsite();

        // *** EXPLANATION: No navigation occurs here by design. ***
        // Settings pages often stay on the page after saving to allow further edits
        // or simply confirm the save with a notification.
        // If navigation *is* required after saving, uncomment and adjust one of the lines below:
        // navigate(`/website/${numericWebsiteId}`); // Navigate back to details page
        // navigate('/'); // Navigate to dashboard

     } catch (err) {
        const apiError = err as ApiError;
        console.error("Failed to update settings:", apiError);
        // Use the mutation error state first if available, fallback to caught error
        const message = (errorUpdating as ApiError)?.message || apiError.message || "Failed to save settings.";
        // Show error in form status area
        setStatus({ error: message });
        // Show error in snackbar
        setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
     } finally {
        // Formik v2+ handles setting isSubmitting to false automatically when the onSubmit promise resolves/rejects
        // setSubmitting(false); // Usually not needed explicitly
     }
  };

  const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteConfirmOpen(false), []);

  const handleDeleteConfirm = useCallback(async () => {
    closeDeleteDialog();
    // Should not happen if button is enabled
    if (!numericWebsiteId) return;

    try {
      // Use the renamed mutation function
      await removeWebsite(numericWebsiteId);
      // Provide more context in the success message
      setNotification({ open: true, message: `Website "${userWebsite?.name || userWebsite?.website?.url || 'ID: '+numericWebsiteId}" removed successfully.`, severity: "success" });

      // *** FIX: Remove the setTimeout for faster navigation ***
      // The previous setTimeout(..., 1500) was causing the delay to allow the user
      // to read the success message. Removing it makes navigation immediate.
      navigate("/"); // Redirect immediately after successful removal

    } catch (err) {
      const apiError = err as ApiError;
      console.error("Failed to delete website:", apiError);
      // Use mutation error state if available
      const message = (errorRemoving as ApiError)?.message || apiError.message || 'Unknown error removing website';
      setNotification({ open: true, message: `Error removing website: ${message}`, severity: "error" });
    }
    // Include errorRemoving dependency
  }, [numericWebsiteId, removeWebsite, navigate, userWebsite?.name, userWebsite?.website?.url, closeDeleteDialog, errorRemoving]);

  const handleBackClick = useCallback(() => {
    // Navigate back to detail page if ID exists, otherwise dashboard
    navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
  }, [navigate, numericWebsiteId]);

  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  // Combine relevant loading states for disabling UI elements
  const isLoading = isWebsiteLoading || isUpdating || isRemoving;

  // --- Render Logic ---

  // Handle Invalid ID in URL parameter
  if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
     return <Container sx={{mt: 4}}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
  }

  // Handle Initial Loading State
  if (isWebsiteLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" my={5}><CircularProgress /></Box>
      </Container>
    );
  }

  // Handle Query Error State
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

  // Handle Case where website query succeeded but returned no data (e.g., 404 from API or user lost access)
   if (!isWebsiteLoading && !userWebsite) {
       return (
         <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
           <Alert severity="warning">Website not found in your dashboard or access denied.</Alert>
           <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>
               Return to Dashboard
            </Button>
         </Container>
       );
   }

  // --- Main Render ---
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title="Back to Website Details">
              <IconButton onClick={handleBackClick} aria-label="Back to website details" disabled={isLoading}>
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            <Typography variant="h4" component="h1">
                Website Settings
            </Typography>
          </Stack>
          {/* Display URL safely */}
          <Typography variant="body2" color="textSecondary" noWrap title={userWebsite?.website?.url ?? ''}>
             {userWebsite?.website?.url ?? 'Loading URL...'}
          </Typography>
      </Box>

      <Formik
        // Derived from useMemo
        initialValues={initialValues}
        validationSchema={WebsiteSettingsSchema}
        onSubmit={handleSubmit}
        // Keeps form synced if initialValues change
        enableReinitialize
      >
        {/* Formik render props */}
        {({ errors, touched, values, isSubmitting, status, dirty, isValid }) => (
          <Form noValidate>
            {/* Display Formik status errors (set in handleSubmit) or mutation errors */}
            {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
            {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {(errorUpdating as ApiError).message}</Alert>}
            {/* Success message is handled by Snackbar */}

            {/* General Settings Paper */}
             {/* Added elevation */}
            <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
              <Typography variant="h6" gutterBottom>General Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              {/* Use Grid v2 */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Website Name"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    required
                    // Disable based on combined loading state
                    disabled={isLoading}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Check Interval (seconds)"
                    name="interval"
                    // Use number input
                    type="number"
                    error={touched.interval && Boolean(errors.interval)}
                    helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                    required
                    // Add step for usability
                    InputProps={{ inputProps: { min: 30, step: 30 } }}
                    disabled={isLoading}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Alert Settings Paper */}
             {/* Added elevation */}
            <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
              <Typography variant="h6" gutterBottom>Alert Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              <FormControlLabel
                control={<Field as={Switch} name="alertEnabled" color="primary" disabled={isLoading} />}
                label="Enable Downtime / Slow Response Alerts"
                // Add margin if fields shown below
                sx={{ mb: values.alertEnabled ? 2 : 0 }}
              />
              {values.alertEnabled && (
                // Use Grid v2
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      label="Response Time Threshold (ms)"
                      name="alertThreshold"
                      // Use number input
                      type="number"
                      error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                      helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (ms)"}
                      // Minimum 1ms
                      InputProps={{ inputProps: { min: 1 } }}
                      disabled={isLoading}
                      // Conditionally required
                      required={values.alertEnabled}
                    />
                  </Grid>
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
                      // Conditionally required
                      required={values.alertEnabled}
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
                // Disable if any operation is in progress
                disabled={isLoading}
                data-testid="delete-button"
              >
                Remove Website
              </Button>
              <Button
                type="submit"
                variant="contained"
                // Use isSubmitting (from Formik) OR isUpdating (from mutation)
                startIcon={isSubmitting || isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                 // Disable if loading, formik submitting, form hasn't changed, or is invalid
                disabled={isLoading || isSubmitting || !dirty || !isValid}
                data-testid="save-button"
              >
                {isSubmitting || isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </Box>
          </Form>
        )}
      </Formik>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        // Prevent closing while deleting
        onClose={!isRemoving ? closeDeleteDialog : undefined}
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
          <DialogTitle id="delete-confirm-title">Confirm Removal</DialogTitle>
          <DialogContent>
              <DialogContentText id="delete-confirm-description">
                  Are you sure you want to remove "{userWebsite?.name || userWebsite?.website?.url}"? This will stop monitoring and remove it from your dashboard.
              </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={closeDeleteDialog} disabled={isRemoving}>Cancel</Button>
              <Button
                  onClick={handleDeleteConfirm}
                  color="error"
                  variant="contained"
                  // Use correct loading state
                  disabled={isRemoving}
                  startIcon={isRemoving ? <CircularProgress size={16} color="inherit"/> : null}
                >
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