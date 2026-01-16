
'use client';
import { useMemo } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

// Represents the shape of user profile data stored in Firestore
export interface UserProfile {
  username?: string;
  role?: 'admin' | 'editor' | 'uploader' | 'viewer';
  departamento?: string;
  distrito?: string;
  modules?: string[];
  permissions?: string[];
}

// Combines Firebase Auth user with Firestore profile data
export type AppUser = User & {
  profile?: UserProfile | null;
};

// Result for the useUser hook
export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook to get the current authenticated user, enriched with their Firestore profile data.
 * @returns {UserHookResult} Object with the enriched user, loading status, and error.
 */
export const useUser = (): UserHookResult => {
  const { user: authUser, isUserLoading: isAuthLoading, userError: authError, firestore } = useFirebase();

  // Memoize the document reference to prevent re-fetching on every render
  const userProfileDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);

  // Use the useDoc hook to fetch the user's profile data
  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileDocRef);
  
  // Combine auth user and profile data
  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    return {
      ...authUser,
      profile: profileData,
    };
  }, [authUser, profileData]);

  return {
    user: enrichedUser,
    isUserLoading: isAuthLoading || isProfileLoading, // Loading if either auth state or profile is loading
    userError: authError || profileError, // Return the first error encountered
  };
};
