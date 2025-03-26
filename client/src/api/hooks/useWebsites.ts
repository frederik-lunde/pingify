// // src/api/hooks/useWebsites.ts
// import { useState, useCallback } from 'react';
// import { UserWebsite, WebsiteCreateDTO, WebsiteUpdateDTO } from '../../types';
// import { 
//   getUserWebsites, 
//   getUserWebsiteById, 
//   addWebsiteToUser, 
//   updateUserWebsite, 
//   removeWebsiteFromUser,
// } from '../websites';
// import { DEFAULT_POLLING_INTERVAL } from '../config';
// import { usePolling, PollingOptions } from '../../hooks/common';

// /**
//  * Hook for getting and polling user's websites list
//  */
// export function useWebsites(
//   pollingInterval = DEFAULT_POLLING_INTERVAL,
//   options?: Partial<PollingOptions<UserWebsite[]>>
// ) {
//   const fetchWebsites = useCallback(async () => {
//     return await getUserWebsites();
//   }, []);

//   return usePolling<UserWebsite[]>(fetchWebsites, { 
//     pollingInterval,
//     ...options
//   });
// }

// /**
//  * Hook for getting a single website from user's dashboard by ID
//  */
// export function useWebsite(
//   websiteId: number, 
//   pollingInterval = DEFAULT_POLLING_INTERVAL,
//   options?: Partial<PollingOptions<UserWebsite>>
// ) {
//   const fetchWebsite = useCallback(async () => {
//     return await getUserWebsiteById(websiteId);
//   }, [websiteId]);

//   return usePolling<UserWebsite>(fetchWebsite, { 
//     pollingInterval,
//     ...options
//   });
// }


// /**
//  * Hook for website CRUD operations
//  */
// export function useWebsiteCrud() {
//   const [loading, setLoading] = useState<boolean>(false);
//   const [error, setError] = useState<Error | null>(null);

//   const create = useCallback(async (websiteData: WebsiteCreateDTO) => {
//     setLoading(true);
//     setError(null);
    
//     try {
//       const result = await addWebsiteToUser(websiteData);
//       return result;
//     } catch (err) {
//       const errorObj = err instanceof Error ? err : new Error('Failed to create website');
//       setError(errorObj);
//       throw errorObj;
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const update = useCallback(async (websiteId: number, websiteData: WebsiteUpdateDTO) => {
//     setLoading(true);
//     setError(null);
    
//     try {
//       const result = await updateUserWebsite(websiteId, websiteData);
//       return result;
//     } catch (err) {
//       const errorObj = err instanceof Error ? err : new Error(`Failed to update website ID: ${websiteId}`);
//       setError(errorObj);
//       throw errorObj;
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const remove = useCallback(async (websiteId: number) => {
//     setLoading(true);
//     setError(null);
    
//     try {
//       await removeWebsiteFromUser(websiteId);
//       return true;
//     } catch (err) {
//       const errorObj = err instanceof Error ? err : new Error(`Failed to delete website ID: ${websiteId}`);
//       setError(errorObj);
//       throw errorObj;
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   /**
//    * Utility function to toggle the alert enabled status for a website
//    */
//   const toggleAlertEnabled = useCallback(async (websiteId: number, currentStatus: boolean) => {
//     return update(websiteId, { alertEnabled: !currentStatus });
//   }, [update]);

//   return { 
//     create, 
//     update, 
//     remove, 
//     toggleAlertEnabled,
//     loading, 
//     error 
//   };
// }