// src/pages/AddWebsite.tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, TextField, Button, Box, Switch,
  FormControlLabel, Alert, Tooltip, IconButton, CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Use Grid v2 (already imported correctly)
import { Add as AddIcon, HelpOutline as HelpIcon } from "@mui/icons-material";
import { WebsiteCreateDTO, Website, ApiError } from "../types";
import WebsiteUrlSearch from "../components/WebsiteUrlSearch";
import { useWebsiteMutations } from "../hooks/api/useWebsites";
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";

// Helper to ensure URL has a protocol
const ensureUrlProtocol = (url: string): string => {
    if (!url) return "";
    if (!url.match(/^https?:\/\//i)) {
        return `https://${url}`;
    }
    return url;
};

// Form values interface
interface AddWebsiteFormValues {
  name: string;
  url: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number | string;
  notifyEmail: string;
}

// URL validation regex
const websiteUrlRegex = /^https?:\/\/.+\..+/;

// Validation schema using Yup
const AddWebsiteSchema = Yup.object().shape({
  name: Yup.string().trim().required("Website name is required"),
  url: Yup.string()
    .trim()
    .matches(websiteUrlRegex, "Please enter a valid URL (e.g., https://example.com)")
    .required("URL is required"),
  interval: Yup.number()
    .min(30, "Interval must be at least 30 seconds")
    .max(86400, "Interval must be at most 1 day (86400 seconds)")
    .required("Check interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .min(1, "Threshold must be at least 1 millisecond")
        .max(60000, "Threshold must be at most 60000 milliseconds (1 min)")
        .required("Response threshold is required when alerts are enabled")
        .typeError("Threshold must be a number"),
      otherwise: (schema) => schema.optional(),
    }),
  notifyEmail: Yup.string()
    .email("Please enter a valid email address")
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema.required("Email is required when alerts are enabled"),
      otherwise: (schema) => schema.optional(),
    }),
});

const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  const { create: createWebsite, isCreating, errorCreating } = useWebsiteMutations();
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);

  const initialValues: AddWebsiteFormValues = {
    name: "",
    url: "",
    interval: 300,
    alertEnabled: false,
    alertThreshold: 1000,
    notifyEmail: "",
  };

  const handleSubmit = async (
    values: AddWebsiteFormValues,
    formikHelpers: FormikHelpers<AddWebsiteFormValues>
  ) => {
    const { setSubmitting, setStatus } = formikHelpers;
    setStatus({ error: null });

    const websiteData: WebsiteCreateDTO = {
      name: values.name.trim(),
      url: ensureUrlProtocol(values.url.trim()),
      interval: Number(values.interval),
      alertEnabled: values.alertEnabled,
      alertThreshold: values.alertEnabled ? Number(values.alertThreshold) : null,
      notifyEmail: values.alertEnabled ? values.notifyEmail.trim() || null : null,
    };

    try {
      const newWebsite = await createWebsite(websiteData);
      setNotification({ open: true, message: `Website "${newWebsite.name || newWebsite.website.url}" added!`, severity: "success" });
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      const apiError = err as ApiError;
      console.error("Failed to add website:", apiError);
      setStatus({ error: apiError.message || "An unexpected error occurred." });
      setNotification({ open: true, message: `Error: ${apiError.message || "Failed to add website."}`, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const handleUrlSelect = useCallback((website: Website | null, setFieldValue: (field: string, value: any) => void, currentName: string) => {
        if (website && !currentName) {
          try {
            const hostname = new URL(website.url).hostname.replace(/^www\./, "");
            setFieldValue("name", hostname);
          } catch (e) {
            console.error("Invalid URL format for prefilling name:", website.url, e);
          }
        }
    }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>

        <Formik
          initialValues={initialValues}
          validationSchema={AddWebsiteSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, isSubmitting, setFieldValue, status }) => (
            <Form>
              {status?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>
              )}
              {errorCreating && !status?.error && (
                 <Alert severity="error" sx={{ mb: 3 }}>{errorCreating.message}</Alert>
              )}

              <Box sx={{ mt: 3 }}>
                {/* Grid v2 container props are valid */}
                <Grid container spacing={3}>
                  {/* Website Name - Use size prop */}
                  <Grid size={{ xs: 12 }}>
                    <Field as={TextField} name="name" label="Website Name" fullWidth required variant="outlined" error={touched.name && Boolean(errors.name)} helperText={ (touched.name && errors.name) || "A name to identify this website in your dashboard" } disabled={isSubmitting || isCreating}/>
                  </Grid>

                  {/* Website URL with Search Component - Use size prop */}
                  <Grid size={{ xs: 12 }}>
                    <WebsiteUrlSearch
                      name="url"
                      label="Website URL"
                      placeholder="https://example.com"
                      helperText="Enter the full URL including http:// or https://"
                      searchLimit={10}
                      disabled={isSubmitting || isCreating}
                      onSelect={(website) => handleUrlSelect(website, setFieldValue, values.name)}
                    />
                  </Grid>

                  {/* Check Interval - Use size prop */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Field as={TextField} name="interval" label="Check Interval (seconds)" type="number" fullWidth required variant="outlined" error={touched.interval && Boolean(errors.interval)} helperText={ (touched.interval && errors.interval) || "Minimum 30s" } InputProps={{ inputProps: { min: 30, step: 30 } }} disabled={isSubmitting || isCreating}/>
                  </Grid>

                  {/* Alert Settings Section - Use size prop */}
                  <Grid size={{ xs: 12 }} sx={{ borderTop: 1, borderColor: "divider", pt: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel control={ <Field as={Switch} name="alertEnabled" color="primary" disabled={isSubmitting || isCreating}/> } label="Enable Alerts"/>
                      <Tooltip title="Get notified when the website goes down or response time exceeds the threshold">
                        <IconButton size="small" tabIndex={-1}><HelpIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>

                  {/* Conditional Alert Fields */}
                  {values.alertEnabled && (
                    <>
                      {/* Response Time Threshold - Use size prop */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field as={TextField} name="alertThreshold" label="Response Threshold (ms)" type="number" fullWidth variant="outlined" error={touched.alertThreshold && Boolean(errors.alertThreshold)} helperText={ (touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (ms)" } InputProps={{ inputProps: { min: 1 } }} disabled={isSubmitting || isCreating} required={values.alertEnabled}/>
                      </Grid>

                      {/* Notification Email - Use size prop */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field as={TextField} name="notifyEmail" label="Notification Email" type="email" fullWidth variant="outlined" error={touched.notifyEmail && Boolean(errors.notifyEmail)} helperText={ (touched.notifyEmail && errors.notifyEmail) || "Email address for alerts" } disabled={isSubmitting || isCreating} required={values.alertEnabled}/>
                      </Grid>
                    </>
                  )}

                  {/* Action Buttons - Use size prop */}
                  <Grid size={{ xs: 12 }} sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate("/")} disabled={isSubmitting || isCreating}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={isSubmitting || isCreating} startIcon={ (isSubmitting || isCreating) ? <CircularProgress size={20} color="inherit" /> : <AddIcon /> }>
                      {(isSubmitting || isCreating) ? "Adding..." : "Add Website"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>

      <FormNotification notification={notification} onClose={handleNotificationClose} />
    </Container>
  );
};

export default AddWebsite;