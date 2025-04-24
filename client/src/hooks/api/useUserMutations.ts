// src/hooks/api/useUserMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    updateUserProfileApi,
    updateUserPasswordApi,
    deleteUserAccountApi,
    UpdateUserDataPayload,
    UpdatePasswordPayload,
    UpdateUserResponse,
} from '../../api/userApi';
import { ApiError } from '../../types';
import { authQueryKeys } from './useAuth'; // Import query keys for invalidation
import { useAuth } from '../../context/AuthContext'; // To call logout on delete

/**
 * Hook for updating user profile (name/email).
 */
export function useUpdateUserProfileMutation() {
    const queryClient = useQueryClient();

    return useMutation<UpdateUserResponse, ApiError, UpdateUserDataPayload>({
        mutationFn: updateUserProfileApi,
        onSuccess: (data) => {
            // Update the cached user data
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
            // Optionally invalidate other queries if user name/email is used elsewhere directly
            console.log("Profile update successful via mutation hook");
            // Success feedback should be handled in the component (e.g., Snackbar)
        },
        onError: (error) => {
            console.error("Profile update mutation failed:", error.message);
            // Error feedback handled in the component
        },
    });
}

/**
 * Hook for updating user password.
 */
export function useUpdateUserPasswordMutation() {
    // No cache invalidation needed here as password is not stored in frontend state
    return useMutation<{ message: string }, ApiError, UpdatePasswordPayload>({
        mutationFn: updateUserPasswordApi,
        onSuccess: (data) => {
            console.log("Password update successful:", data.message);
             // Success feedback handled in the component
        },
        onError: (error) => {
            console.error("Password update mutation failed:", error.message);
            // Error feedback handled in the component
        },
    });
}

/**
 * Hook for deleting the user account.
 */
export function useDeleteUserAccountMutation() {
 
    const { logout } = useAuth(); // Get logout function from context

    return useMutation<void, ApiError, void>({ // Takes void as input
        mutationFn: deleteUserAccountApi,
        onSuccess: () => {
            console.log("Account deletion successful.");
          
            logout(); 
           
        },
        onError: (error) => {
            console.error("Account deletion mutation failed:", error.message);
             // Error feedback handled in the component
        },
    });
}