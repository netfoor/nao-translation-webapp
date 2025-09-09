'use client'

import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { configureAmplify } from '@/amplify/config';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureAmplify();
    (async () => {
      try {
        // Check if user is already signed in
        await getCurrentUser();
        // If we get here, user is signed in, redirect to home
        router.replace('/');
      } catch (e: any) {
        // If no user found, there might be an actual error
        if (e.message?.includes('already a signed in user')) {
          // This is not really an error, just redirect
          router.replace('/');
        } else {
          setError(e?.message ?? 'Authentication failed');
        }
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {error ? 'Authentication Error' : 'Completing Sign-In'}
            </h1>
            {error ? (
              <div>
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => router.replace('/')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Return to Home
                </button>
              </div>
            ) : (
              <div>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Redirecting to your dashboard...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
