'use client'

import { useEffect, useRef, useState } from 'react';
import outputs from '../../../amplify_outputs.json';

type TranscribeResponse = {
  sessionId: string;
  websocketUrl: string;
  signedUrl?: string;
  connectionParams: Record<string, any>;
};

export default function LambdaTestPage() {
  const [httpResult, setHttpResult] = useState<TranscribeResponse | null>(null);
  const [httpError, setHttpError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [wsLog, setWsLog] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
  const websocketEndpoint = (outputs as any)?.custom?.websocketEndpoint as string | undefined;

  const callTranscribeConnection = async () => {
    if (!httpApiUrl) {
      setHttpError('HTTP API URL not found in amplify_outputs.json. Redeploy sandbox to refresh outputs.');
      return;
    }
    setHttpError(null);
    setHttpResult(null);
    try {
      const res = await fetch(`${httpApiUrl}/transcribe-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceLanguage: 'en-US', targetLanguage: 'es', userId: 'self' }),
      });
      const json = await res.json();
      setHttpResult(json);
    } catch (e: any) {
      setHttpError(e?.message ?? 'Request failed');
    }
  };

  const connectWebSocket = () => {
    if (!websocketEndpoint) {
      setWsStatus('disconnected');
      setWsLog((prev) => [...prev, 'WebSocket endpoint missing in outputs']);
      return;
    }
    setWsStatus('connecting');
    const url = httpResult?.signedUrl ?? websocketEndpoint;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsStatus('connected');
      setWsLog((prev) => [...prev, 'Connected']);
    };
    ws.onmessage = (ev) => setWsLog((prev) => [...prev, `Message: ${ev.data}`]);
    ws.onerror = (ev) => setWsLog((prev) => [...prev, 'Error']);
    ws.onclose = () => {
      setWsStatus('disconnected');
      setWsLog((prev) => [...prev, 'Closed']);
    };
  };

  const sendTranscript = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setWsLog((prev) => [...prev, 'WebSocket not connected']);
      return;
    }
    const payload = {
      transcript: 'Hello, how are you?',
      sessionId: httpResult?.sessionId ?? `session-${Date.now()}`,
      sourceLanguage: 'en',
      targetLanguage: 'es',
    };
    wsRef.current.send(JSON.stringify(payload));
    setWsLog((prev) => [...prev, `Sent: ${JSON.stringify(payload)}`]);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Lambda Test</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Transcribe Connection (HTTP API)</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={callTranscribeConnection}>Call Lambda</button>
        </div>
        {httpError && <p className="text-red-600">{httpError}</p>}
        {httpResult && (
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">{JSON.stringify(httpResult, null, 2)}</pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">WebSocket Handler</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={connectWebSocket} disabled={wsStatus !== 'disconnected'}>
            {wsStatus === 'disconnected' ? 'Connect' : wsStatus}
          </button>
          <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={sendTranscript}>Send Transcript</button>
        </div>
        <div className="bg-gray-100 p-3 rounded text-sm h-48 overflow-auto">
          {wsLog.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </section>
    </div>
  );
}


