import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
interface ConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    confirmButtonColor?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
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
    confirmButtonColor = "primary",
}) => {
    return (
        <Dialog
            open={open}
            onClose={isLoading ? undefined : onClose}
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-description"
            disableEscapeKeyDown={isLoading}
        >
            <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id="confirmation-dialog-description">
                    {description}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                {}
                <Button onClick={onClose} disabled={isLoading}>
                    {cancelText}
                </Button>
                {}
                <Button
                    onClick={onConfirm}
                    color={confirmButtonColor}
                    variant="contained"
                    disabled={isLoading}
                    autoFocus
                >
                    {}
                    {isLoading ? 'Processing...' : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
export default ConfirmationDialog;