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
import { authQueryKeys } from './useAuth';
import { useAuth } from '../../context/AuthContext';

/**
 * Custom hook for updating the user's profile information.
 */
export function useUpdateUserProfileMutation() {
    const queryClient = useQueryClient();
    return useMutation<UpdateUserResponse, ApiError, UpdateUserDataPayload>({
        mutationFn: updateUserProfileApi,
        onSuccess: (data) => {
            queryClient.setQueryData(authQueryKeys.me, { user: data.user });
        },
        onError: (error) => {
            console.error("Profile update mutation failed:", error.message);
        },
    });
}

/**
 * Custom hook for updating the user's password.
 */
export function useUpdateUserPasswordMutation() {
    return useMutation<{ message: string }, ApiError, UpdatePasswordPayload>({
        mutationFn: updateUserPasswordApi,
        onSuccess: (data) => {
            console.log("Password update successful:", data.message);
        },
        onError: (error) => {
            console.error("Password update mutation failed:", error.message);
        },
    });
}

/**
 * Custom hook for deleting the user's account.
 */
export function useDeleteUserAccountMutation() {
    const auth = useAuth();
    return useMutation<void, ApiError, void>({
        mutationFn: deleteUserAccountApi,
        onSuccess: () => {
            auth?.logout();
        },
        onError: (error) => {
            console.error("Account deletion mutation failed:", error.message);
        },
    });
}