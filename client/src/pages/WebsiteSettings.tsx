// client/src/pages/WebsiteSettings.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router"; 
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
  Button, Divider, CircularProgress, Alert, IconButton, Tooltip,
  Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack // Added Dialog
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Use Grid v2
import {
  ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";
// Import the specific query and mutation hooks needed
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks/api/useWebsites"; // Correct hooks
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification"; // Assuming this component exists
import { WebsiteUpdateDTO, UserWebsite, ApiError } from "../types"; // Import types

// Form values interface
interface WebsiteSettingsFormValues {
  name: string;
  interval: number | string; // Allow string initially from text field
  alertEnabled: boolean;
  alertThreshold: number | string; // Allow string initially
  notifyEmail: string;
}

// Validation schema using Yup
const WebsiteSettingsSchema = Yup.object().shape({
  name: Yup.string().trim().required("Website name is required"),
  interval: Yup.number()
    .min(30, "Interval must be at least 30 seconds") // Consistent minimum
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
      otherwise: (schema) => schema.optional().nullable(), // Allow empty/null if alerts disabled
    }),
});


// No longer needed as props, ID comes from useParams
// interface WebsiteSettingsProps {
//   websiteId: number;
// }

const WebsiteSettings: React.FC = () => {
  const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();

  // Validate and convert URL param
   const numericWebsiteId = useMemo(() => {
      const id = parseInt(websiteIdParam || '', 10);
      return isNaN(id) ? undefined : id;
  }, [websiteIdParam]);


  // --- UI State ---
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false); // State for delete dialog

  // --- TanStack Query Hook for fetching initial website data ---
  const {
    data: userWebsite, // Data returned by the query hook
    isLoading: isWebsiteLoading,
    error: websiteError,
    refetch: refetchWebsite, // Function to refetch website data
  } = useUserWebsiteQuery(numericWebsiteId, {
     enabled: !!numericWebsiteId, // Only fetch if ID is valid
     staleTime: 1000 * 60 * 5, // Data can be stale for 5 mins
  });

  // --- TanStack Mutation Hooks for update/delete ---
  const {
      update: updateWebsite,
      remove: deleteWebsite,
      isUpdating, // Loading state for update mutation
      isDeleting, // Loading state for delete mutation
      errorUpdating, // Error from update mutation
      errorDeleting, // Error from delete mutation
   } = useWebsiteMutations();

  // Initial form values derived from the query data
   const initialValues = useMemo((): WebsiteSettingsFormValues => {
        return {
            name: userWebsite?.name || "",
            interval: userWebsite?.interval || 300, // Default interval
            alertEnabled: userWebsite?.alertEnabled ?? false,
            alertThreshold: userWebsite?.alertThreshold ?? 1000, // Default threshold
            notifyEmail: userWebsite?.notifyEmail || "", // Default email
        };
    }, [userWebsite]); // Recalculate when userWebsite data changes


  // Form submission handler
  const handleSubmit = async (
    values: WebsiteSettingsFormValues,
    formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
  ) => {
     const { setSubmitting, setStatus } = formikHelpers;
     setStatus({ error: null }); // Clear previous errors

     if (!numericWebsiteId) {
         setStatus({ error: "Invalid Website ID."});
         setSubmitting(false);
         return;
     }

     // Prepare update data DTO
     const updateData: WebsiteUpdateDTO = {
        name: values.name.trim(),
        interval: Number(values.interval), // Ensure interval is number
        alertEnabled: values.alertEnabled,
        // Ensure threshold/email are null if alerts are disabled
        alertThreshold: values.alertEnabled ? Number(values.alertThreshold) || null : null,
        notifyEmail: values.alertEnabled ? values.notifyEmail.trim() || null : null,
     };

     try {
        // Call the update mutation
        await updateWebsite({ websiteId: numericWebsiteId, websiteData: updateData });
        setStatus({ success: "Settings saved successfully!" }); // Set success status
        setNotification({ open: true, message: "Settings saved!", severity: "success" });
        // Optionally refetch data after successful update if needed immediately
        // refetchWebsite();
        // Consider navigating back after save, maybe after a delay
        // setTimeout(() => navigate(`/website/${numericWebsiteId}`), 1000);
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

  // --- Delete Handlers ---
  const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteConfirmOpen(false), []);

  const handleDeleteConfirm = useCallback(async () => {
    closeDeleteDialog(); // Close dialog immediately
    if (!numericWebsiteId) return;

    try {
      // Call the delete mutation
      await deleteWebsite(numericWebsiteId);
      setNotification({ open: true, message: `Website "${userWebsite?.name || 'ID: '+numericWebsiteId}" removed.`, severity: "success" });
      // Redirect to dashboard after successful deletion
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      const apiError = err as ApiError;
      console.error("Failed to delete website:", apiError);
      setNotification({ open: true, message: `Error removing website: ${apiError.message || 'Unknown error'}`, severity: "error" });
    }
  }, [numericWebsiteId, deleteWebsite, navigate, userWebsite?.name, closeDeleteDialog]); // Added dependencies


  // Navigation handler
  const handleBackClick = useCallback(() => {
     // Navigate back to details page or dashboard if no ID
    navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
  }, [navigate, numericWebsiteId]);

  // Handle notification close
  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  // Combined loading state for disabling form actions
  const isLoading = isWebsiteLoading || isUpdating || isDeleting;

  // --- Render Logic ---

  // Handle invalid ID parameter
  if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
     return <Container sx={{mt: 4}}><Alert severity="error">Invalid Website ID provided.</Alert></Container>;
  }

  // Loading state for initial data fetch
  if (isWebsiteLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" my={5}><CircularProgress /></Box>
      </Container>
    );
  }

  // Error state for initial data fetch
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

  // Handle case where website doesn't exist or user doesn't have access
   if (!isWebsiteLoading && !userWebsite) {
       return (
         <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
           <Alert severity="warning">Website not found or access denied.</Alert>
           <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
         </Container>
       );
   }

  // --- Render Settings Form ---
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Back to Website Details">
            <IconButton onClick={handleBackClick} aria-label="Back to website details">
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" component="h1">Website Settings</Typography>
        </Stack>
         {/* Display URL (read-only) */}
         <Typography variant="body2" color="textSecondary" noWrap title={userWebsite?.website?.url}>
             {userWebsite?.website?.url}
         </Typography>
      </Box>

      <Formik
        initialValues={initialValues} // Use memoized initial values
        validationSchema={WebsiteSettingsSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true} // Update form if query data changes
      >
        {({ errors, touched, values, isSubmitting, status }) => (
          <Form>
            {/* Display Formik status errors/success */}
            {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
            {status?.success && <Alert severity="success" sx={{ mb: 3 }}>{status.success}</Alert>}
             {/* Display direct mutation errors if not handled by status */}
             {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {errorUpdating.message}</Alert>}


            {/* General Settings Card */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>General Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Field as={TextField} fullWidth label="Website Name" name="name" error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name} required disabled={isLoading}/>
                </Grid>
                <Grid xs={12} md={6}>
                  <Field as={TextField} fullWidth label="Check Interval (seconds)" name="interval" type="number" error={touched.interval && Boolean(errors.interval)} helperText={ (touched.interval && errors.interval) || "Minimum 30 seconds" } required InputProps={{ inputProps: { min: 30 } }} disabled={isLoading}/>
                </Grid>
              </Grid>
            </Paper>

            {/* Alert Settings Card */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>Alert Settings</Typography>
              <Divider sx={{ mb: 3 }} />
              <FormControlLabel control={ <Field as={Switch} name="alertEnabled" color="primary" disabled={isLoading}/> } label="Enable Alerts" sx={{ mb: 2 }}/>
              {/* Show alert fields only if enabled */}
              {values.alertEnabled && (
                <Grid container spacing={3}>
                  <Grid xs={12} md={6}>
                    <Field as={TextField} fullWidth label="Response Time Threshold (ms)" name="alertThreshold" type="number" error={touched.alertThreshold && Boolean(errors.alertThreshold)} helperText={ (touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (ms)" } InputProps={{ inputProps: { min: 1 } }} disabled={isLoading} required={values.alertEnabled}/>
                  </Grid>
                  <Grid xs={12} md={6}>
                    <Field as={TextField} fullWidth label="Notification Email" name="notifyEmail" type="email" error={touched.notifyEmail && Boolean(errors.notifyEmail)} helperText={ (touched.notifyEmail && errors.notifyEmail) || "Email address for alerts" } disabled={isLoading} required={values.alertEnabled}/>
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* Actions Footer */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: 'center', mt: 4, gap: 2, flexWrap: 'wrap' }}>
               {/* Delete Button */}
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={openDeleteDialog} disabled={isLoading} data-testid="delete-button">
                Remove Website
              </Button>
               {/* Save Button */}
              <Button type="submit" variant="contained" startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} disabled={isLoading || isSubmitting} data-testid="save-button">
                {isUpdating || isSubmitting ? "Saving..." : "Save Changes"}
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
                  Are you sure you want to remove "{userWebsite?.name || userWebsite?.website?.url}"? This action cannot be undone and all associated monitoring data will be lost.
              </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
              <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting} startIcon={isDeleting ? <CircularProgress size={16} color="inherit"/> : null}>
                  {isDeleting ? "Removing..." : "Remove"}
              </Button>
          </DialogActions>
      </Dialog>


      {/* Success/Error Notification Snackbar */}
      <FormNotification notification={notification} onClose={handleNotificationClose} />
    </Container>
  );
};

export default WebsiteSettings;