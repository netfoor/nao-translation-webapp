'use client'

import { useEffect, useState } from 'react';
import { signInWithRedirect } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { configureAmplify } from '@/amplify/config';

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureAmplify();
    (async () => {
      try {
        // Pass through URL params so Amplify can complete the flow
        await signInWithRedirect();
        router.replace('/test');
      } catch (e: any) {
        setError(e?.message ?? 'Unable to complete sign-in');
      }
    })();
  }, [router, params]);

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Completing sign-in…</h1>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <p className="text-gray-600">Please wait, redirecting…</p>
      )}
    </div>
  );
}


