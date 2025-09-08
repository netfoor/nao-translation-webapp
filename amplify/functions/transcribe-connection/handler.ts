import { APIGatewayProxyHandler } from 'aws-lambda';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { parseUrl } from '@aws-sdk/url-parser';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { sourceLanguage, targetLanguage, userId } = JSON.parse(event.body || '{}');
    
    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build SigV4 presigned URL for Transcribe Streaming WebSocket per AWS docs
    const region = process.env.AWS_REGION || 'us-east-1';
    const host = `transcribestreaming.${region}.amazonaws.com:8443`;
    const baseUrl = `wss://${host}/stream-transcription-websocket`;
    const query = new URLSearchParams({
      'language-code': sourceLanguage || 'en-US',
      'media-encoding': 'pcm',
      'sample-rate': '16000',
    });

    const unsignedUrl = `${baseUrl}?${query.toString()}`;

    const signer = new SignatureV4({
      service: 'transcribe',
      region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });

    const request = new HttpRequest({
      ...parseUrl(unsignedUrl),
      method: 'GET',
      headers: {
        host,
      },
    });

    const presigned = await signer.presign(request, { expiresIn: 300 });
    const signedUrl = `${presigned.protocol}//${presigned.hostname}${presigned.path}$${presigned.query ? '?' + Object.entries(presigned.query).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : ''}`;

    const response = {
      sessionId,
      websocketUrl: baseUrl,
      signedUrl,
      connectionParams: {
        sessionId,
        sourceLanguage,
        targetLanguage,
        userId,
        sampleRate: 16000,
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
