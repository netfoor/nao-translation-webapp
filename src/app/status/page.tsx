'use client'

import { useEffect, useState } from 'react';
import { configureAmplify } from '@/amplify/config';
import { getCurrentUser } from 'aws-amplify/auth';
import outputs from '../../../amplify_outputs.json';

export default function StatusPage() {
  const [status, setStatus] = useState<{
    amplify: boolean;
    auth: boolean;
    apis: boolean;
    user?: any;
    error?: string;
  }>({
    amplify: false,
    auth: false,
    apis: false
  });

  useEffect(() => {
    (async () => {
      try {
        // Configure Amplify
        configureAmplify();
        setStatus(prev => ({ ...prev, amplify: true }));

        // Check auth
        try {
          const user = await getCurrentUser();
          setStatus(prev => ({ ...prev, auth: true, user }));
        } catch {
          setStatus(prev => ({ ...prev, auth: false }));
        }

        // Check APIs
        const httpApiUrl = (outputs as any)?.custom?.httpApiUrl;
        if (httpApiUrl) {
          setStatus(prev => ({ ...prev, apis: true }));
        }

      } catch (error: any) {
        setStatus(prev => ({ ...prev, error: error.message }));
      }
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">System Status</h1>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.amplify ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Amplify Configuration: {status.amplify ? 'OK' : 'Failed'}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.auth ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span>Authentication: {status.auth ? 'Signed In' : 'Not Signed In'}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.apis ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>API Endpoints: {status.apis ? 'Available' : 'Not Found'}</span>
        </div>
      </div>

      {status.user && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-medium mb-2">User Info:</h3>
          <pre className="text-sm">{JSON.stringify(status.user, null, 2)}</pre>
        </div>
      )}

      {status.error && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded">
          <h3 className="font-medium mb-2">Error:</h3>
          <p>{status.error}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-100 rounded">
        <h3 className="font-medium mb-2">Configuration:</h3>
        <ul className="text-sm space-y-1">
          <li>Auth Domain: {(outputs as any)?.auth?.oauth?.domain}</li>
          <li>HTTP API: {(outputs as any)?.custom?.httpApiUrl}</li>
          <li>WebSocket: {(outputs as any)?.custom?.websocketEndpoint}</li>
        </ul>
      </div>
    </div>
  );
}
