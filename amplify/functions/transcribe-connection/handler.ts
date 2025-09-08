import { APIGatewayProxyHandler } from 'aws-lambda';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { parseUrl } from '@aws-sdk/url-parser';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { sourceLanguage, targetLanguage, userId, sampleRate: requestedSampleRate } = JSON.parse(event.body || '{}');
    
    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build SigV4 presigned URL for Transcribe Streaming WebSocket
    const region = process.env.AWS_REGION || 'us-east-1';
    const hostname = `transcribestreaming.${region}.amazonaws.com`;
    const sampleRate = Number(requestedSampleRate) || 16000;
    
    const baseUrl = `wss://${hostname}:8443/stream-transcription-websocket`;

    // Include required query parameters BEFORE signing to ensure canonical request matches
    const unsigned = parseUrl(`${baseUrl}?language-code=${encodeURIComponent(sourceLanguage || 'en-US')}&media-encoding=pcm&sample-rate=${encodeURIComponent(String(sampleRate))}`);

    const signer = new SignatureV4({
      service: 'transcribe',
      region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });

    const request = new HttpRequest({
      ...unsigned,
      method: 'GET',
      headers: { host: `${hostname}:8443` },
    });

    const presigned = await signer.presign(request, { expiresIn: 300 });

    // Include port explicitly if present (Transcribe WS uses 8443)
    const portPart = presigned.port ? `:${presigned.port}` : '';
    const queryPart = presigned.query
      ? `?${new URLSearchParams(
          Object.entries(presigned.query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
        ).toString()}`
      : '';
    const signedUrl = `${presigned.protocol}//${presigned.hostname}${portPart}${presigned.path}${queryPart}`;

    const response = {
      sessionId,
      websocketUrl: baseUrl,
      signedUrl,
      connectionParams: {
        sessionId,
        sourceLanguage,
        targetLanguage,
        userId,
        sampleRate,
        mediaEncoding: 'pcm',
      }
    };
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error generating Transcribe connection:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Failed to generate Transcribe connection' }),
    };
  }
};
