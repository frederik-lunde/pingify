// client/src/components/common/FormNotification.tsx
import React from "react";
import { Snackbar, Alert, AlertProps } from "@mui/material";

export interface FormNotificationState {
  open: boolean;
  message: string;
  severity: AlertProps["severity"];
}

interface FormNotificationProps {
  notification: FormNotificationState;
  onClose: () => void;
  autoHideDuration?: number;
  position?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "center" | "right";
  };
}

/**
 * A reusable notification component for forms
 * Shows success/error messages in a consistent way across the application
 */
const FormNotification: React.FC<FormNotificationProps> = ({
  notification,
  onClose,
  autoHideDuration = 6000,
  position = { vertical: "bottom", horizontal: "center" },
}) => {
  const { open, message, severity } = notification;

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={position}
      data-testid="form-notification"
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ width: "100%" }}
        elevation={6}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

// Default initial state for the notification
export const initialNotificationState: FormNotificationState = {
  open: false,
  message: "",
  severity: "info",
};

export default FormNotification;