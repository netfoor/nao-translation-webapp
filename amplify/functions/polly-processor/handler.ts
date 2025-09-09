import { APIGatewayProxyHandler } from 'aws-lambda';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const pollyClient = new PollyClient({});
const s3Client = new S3Client({});

// Map language codes to appropriate Polly voices with correct language codes
const voiceMap: { [key: string]: { voiceId: string; languageCode: string } } = {
  'en': { voiceId: 'Joanna', languageCode: 'en-US' },
  'es': { voiceId: 'Lucia', languageCode: 'es-ES' }, 
  'fr': { voiceId: 'Lea', languageCode: 'fr-FR' },
  'de': { voiceId: 'Vicki', languageCode: 'de-DE' },
  'it': { voiceId: 'Bianca', languageCode: 'it-IT' },
  'pt': { voiceId: 'Camila', languageCode: 'pt-BR' },
};

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { text, targetLanguage } = JSON.parse(event.body || '{}');
    if (!text || !targetLanguage) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text/targetLanguage' }) };
    }

    const voiceConfig = voiceMap[targetLanguage] || { voiceId: 'Joanna', languageCode: 'en-US' };
    
    // Synthesize speech with Polly
    const synthesizeCommand = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceConfig.voiceId as any,
      LanguageCode: voiceConfig.languageCode as any,
      Engine: 'neural',
      TextType: 'text',
    });

    const audioResult = await pollyClient.send(synthesizeCommand);
    
    // Generate unique audio file key
    const audioKey = `translated-audio/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mp3`;
    
    // Upload to S3 using Upload class for streaming AudioStream
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.STORAGE_BUCKET,
        Key: audioKey,
        Body: audioResult.AudioStream,
        ContentType: 'audio/mp3',
      },
    });
    
    await upload.done();
    
    // Generate signed URL for immediate access using GetObjectCommand
    const getCommand = new GetObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: audioKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ 
        audioUrl: signedUrl,
        audioKey,
        voiceId: voiceConfig.voiceId,
        languageCode: voiceConfig.languageCode
      }),
    };
  } catch (error) {
    console.error('polly-processor error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error', details: (error as Error).message }) };
  }
};
