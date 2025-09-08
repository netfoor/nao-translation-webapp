'use client'

import { signInWithRedirect, signOut } from 'aws-amplify/auth';
import { getDataClient } from '@/amplify/client';
import { useEffect, useState } from 'react';

const client = getDataClient();

export default function TestPage() {
  const [sessions, setSessions] = useState<Array<{ id: string; sessionId?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.models.TranslationSession.list({
        selectionSet: ["id", "sessionId"],
      });
      setSessions(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const createSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const nowId = `session-${Date.now()}`;
      await client.models.TranslationSession.create({
        sessionId: nowId,
        userId: 'self',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        status: 'processing' as any,
      });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Amplify Test</h1>
      <div className="flex gap-2">
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => signInWithRedirect()}>Sign In</button>
        <button className="px-3 py-2 bg-gray-600 text-white rounded" onClick={() => signOut()}>Sign Out</button>
        <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={createSession}>Create Session</button>
        <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={refresh}>Refresh</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <ul className="list-disc pl-5">
        {sessions.map(s => (
          <li key={s.id}>{s.id} {s.sessionId ? `(${s.sessionId})` : ''}</li>
        ))}
      </ul>
    </div>
  );
}


