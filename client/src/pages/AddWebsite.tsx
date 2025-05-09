import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, TextField, Button, Box, Switch,
  FormControlLabel, Tooltip, IconButton, CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add as AddIcon, HelpOutline as HelpIcon } from "@mui/icons-material";
import {
    AddWebsiteUserDTO,
    Website,
    WebsiteUser,
    ApiError
} from "../types";
import WebsiteUrlSearch from "../components/WebsiteUrlSearch";
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";
import { useWebsiteMutations } from "../hooks/api/useWebsites";

/**
 * Ensures a URL string has a protocol.
 */
const ensureUrlProtocol = (url: string): string => {
    if (!url) return "";
    if (!/^(https?|ftp):\/\//i.test(url)) { return `https://${url}`; }
    return url;
};

interface AddWebsiteFormValues {
  name: string;
  url: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number | string;
  notifyEmail: string;
}

const websiteUrlRegex = /^(https?:\/\/)((([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)+([a-zA-Z]{2,}|[0-9]{1,3})(\.[0-9]{1,3})?|localhost)(:[0-9]+)?(\/.*)?$/i;

const AddWebsiteSchema = Yup.object().shape({
  url: Yup.string()
    .trim()
    .transform(value => ensureUrlProtocol(value))
    .matches(websiteUrlRegex, "Enter a valid URL (e.g., https://example.com)")
    .required("URL is required"),
  interval: Yup.number()
    .typeError("Interval must be a number")
    .integer("Interval must be a whole number")
    .min(30, "Interval must be at least 30 seconds")
    .max(86400, "Interval must be at most 1 day (86400s)")
    .required("Check interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", ([alertEnabled], schema) => {
        return alertEnabled
            ? schema
                .typeError("Threshold must be a number")
                .min(1, "Threshold must be at least 1ms")
                .max(60000, "Threshold must be 1 min (60000ms) or less")
                .required("Response threshold is required when alerts are enabled")
            : schema.optional().nullable();
    }),
  notifyEmail: Yup.string()
    .email("Enter a valid email address")
     .when("alertEnabled", ([alertEnabled], schema) => {
         return alertEnabled
             ? schema.required("Email is required for alerts")
             : schema.optional().nullable();
     }),
});

/**
 * Extracts a user-friendly error message.
 */
const getErrorMessage = (error: unknown): string => {
    const defaultMessage = "An unexpected error occurred.";
    if (error instanceof Error) {
        if ('name' in error && error.name === 'ApiError' && 'data' in error) {
            const apiError = error as ApiError;
            if (apiError.data && typeof apiError.data === 'object' && 'message' in apiError.data && typeof apiError.data.message === 'string') {
                return apiError.data.message;
            }
        }
        return error.message || defaultMessage;
    }
    return defaultMessage;
};

/**
 * Page component for adding a new website.
 */
const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  const {
      addWebsite,
      isAdding,
      isTriggeringCheck
    } = useWebsiteMutations();
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const isProcessing = isAdding || isTriggeringCheck;

  const initialValues: AddWebsiteFormValues = {
    name: "",
    url: "",
    interval: 300,
    alertEnabled: false,
    alertThreshold: "",
    notifyEmail: "",
  };

  /**
   * Handles form submission for adding a website.
   */
  const handleSubmit = async (
    values: AddWebsiteFormValues,
    formikHelpers: FormikHelpers<AddWebsiteFormValues>
  ) => {
    const { setSubmitting, setStatus } = formikHelpers;
    setStatus(null);
    setNotification(initialNotificationState);

    const alertThresholdNumber = values.alertEnabled && values.alertThreshold !== "" ? Number(values.alertThreshold) : null;

    const websiteData: AddWebsiteUserDTO = {
      name: values.name.trim() || null,
      url: ensureUrlProtocol(values.url.trim()),
      interval: Number(values.interval),
      alertEnabled: values.alertEnabled,
      alertThreshold: alertThresholdNumber,
      notifyEmail: values.alertEnabled && values.notifyEmail.trim() !== ""
          ? values.notifyEmail.trim()
          : null,
    };

     if (isNaN(websiteData.interval!) || websiteData.interval! < 30) {
         setNotification({ open: true, message: "Error: Invalid check interval.", severity: "error" });
         setSubmitting(false);
         return;
     }
     if (websiteData.alertEnabled && (alertThresholdNumber === null || isNaN(alertThresholdNumber) || alertThresholdNumber < 1 )) {
         setNotification({ open: true, message: "Error: Invalid alert threshold (must be >= 1ms).", severity: "error" });
         setSubmitting(false);
         return;
     }

    try {
      const newWebsiteUser: WebsiteUser = await addWebsite(websiteData);
      const successName = newWebsiteUser.name || newWebsiteUser.website?.url || 'Website';
      setNotification({ open: true, message: `Website "${successName}" added successfully! Initial check triggered.`, severity: "success" });
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      console.error("Failed to add website:", err);
      const message = getErrorMessage(err);
      setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
      setSubmitting(false);
    }
  };

  /**
   * Handles closing of the notification snackbar.
   */
  const handleNotificationClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  /**
   * Handles selection of a URL from search results.
   */
  const handleUrlSelect = useCallback((
        website: Website | null,
        setFieldValue: FormikHelpers<AddWebsiteFormValues>['setFieldValue'],
        currentName: string
    ) => {
        if (website?.url) {
             const formattedUrl = ensureUrlProtocol(website.url);
             setFieldValue("url", formattedUrl, true);
             if (!currentName && website.name) {
                 setFieldValue("name", website.name, true);
             } else if (!currentName) {
                try {
                  const hostname = new URL(formattedUrl).hostname.replace(/^www\./, "");
                  setFieldValue("name", hostname, true);
                } catch (e) {
                  console.error("Invalid URL format for prefilling name:", formattedUrl, e);
                }
             }
        }
    }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>
        <Formik
          initialValues={initialValues}
          validationSchema={AddWebsiteSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ errors, touched, values, isSubmitting, setFieldValue, dirty, isValid }) => (
            <Form noValidate>
              <Box sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  {}
                  <Grid size={12}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Website Name"
                      fullWidth
                      variant="outlined"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name ? errors.name : "A name for your dashboard (e.g., My Blog)"}
                      disabled={isSubmitting || isProcessing}
                    />
                  </Grid>
                  {}
                  <Grid size={12}>
                    <WebsiteUrlSearch
                      name="url"
                      label="Website URL"
                      placeholder="https://example.com"
                      helperText="Enter the full URL or search existing sites"
                      searchLimit={10}
                      disabled={isSubmitting || isProcessing}
                      onSelect={(website) => handleUrlSelect(website, setFieldValue, values.name)}
                      required
                    />
                  </Grid>
                  {}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field
                      as={TextField}
                      name="interval"
                      label="Check Interval (seconds)"
                      type="number"
                      fullWidth
                      required
                      variant="outlined"
                      error={touched.interval && Boolean(errors.interval)}
                      helperText={touched.interval && errors.interval ? errors.interval : "Minimum 30 seconds"}
                      InputProps={{ inputProps: { min: 30, step: 30 } }}
                      disabled={isSubmitting || isProcessing}
                    />
                  </Grid>
                   <Grid size={{ xs: 0, sm: 6 }} />
                  {}
                  <Grid size={12} sx={{ borderTop: 1, borderColor: "divider", pt: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            type="checkbox"
                            name="alertEnabled"
                            color="primary"
                            disabled={isSubmitting || isProcessing}
                          />
                        }
                        label="Enable Downtime/Slow Alerts"
                      />
                      <Tooltip title="Get notified via email when the website goes down or response time exceeds the threshold.">
                        <IconButton size="small" tabIndex={-1} sx={{ ml: 0.5 }}><HelpIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                  {}
                  {values.alertEnabled && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="alertThreshold"
                          label="Slow Response Threshold (ms)"
                          type="number"
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled}
                          error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                          helperText={touched.alertThreshold && errors.alertThreshold ? errors.alertThreshold : "Alert if response > value (e.g., 2000)"}
                          InputProps={{ inputProps: { min: 1 } }}
                          disabled={isSubmitting || isProcessing}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="notifyEmail"
                          label="Notification Email"
                          type="email"
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled}
                          error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                          helperText={touched.notifyEmail && errors.notifyEmail ? errors.notifyEmail : "Email address to receive alerts"}
                          disabled={isSubmitting || isProcessing}
                        />
                      </Grid>
                    </>
                  )}
                  {}
                  <Grid size={12} sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate("/")} disabled={isSubmitting || isProcessing}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting || isProcessing || !dirty || !isValid}
                      startIcon={(isSubmitting || isProcessing) ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                    >
                      {(isSubmitting || isAdding) ? "Adding..." : (isTriggeringCheck ? "Checking..." : "Add Website")}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>
      <FormNotification
        notification={notification}
        onClose={handleNotificationClose}
      />
    </Container>
  );
};
export default AddWebsite;