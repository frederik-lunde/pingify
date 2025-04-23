// src/components/common/ConfirmationDialog.tsx
import React from 'react';
import Button from '@mui/material/Button'; // Use standard Button
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
// Removed: import { LoadingButton } from '@mui/lab';

interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean; // To show loading state on confirm button
    confirmButtonColor?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'; // Allow customizing color
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    confirmButtonColor = "primary", // Default to primary
}) => {
    return (
        <Dialog
            open={open}
            // Prevent closing by clicking outside or pressing Esc when loading
            onClose={isLoading ? undefined : onClose}
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-description"
            disableEscapeKeyDown={isLoading} // Prevent Esc close when loading
        >
            <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="confirmation-dialog-description">
                    {description}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                {/* Disable Cancel button while loading */}
                <Button onClick={onClose} disabled={isLoading}>
                    {cancelText}
                </Button>
                {/* Use standard Button */}
                <Button
                    onClick={onConfirm}
                    color={confirmButtonColor} // Use the passed color prop (e.g., 'error' for delete)
                    variant="contained"
                    // Disable the button when loading
                    disabled={isLoading}
                    autoFocus
                >
                    {/* Optionally change text when loading */}
                    {isLoading ? 'Processing...' : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog;