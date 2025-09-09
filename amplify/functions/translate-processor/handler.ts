import { APIGatewayProxyHandler } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const translateClient = new TranslateClient({});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { text, sourceLanguage, targetLanguage } = JSON.parse(event.body || '{}');
    if (!text || !sourceLanguage || !targetLanguage) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text/sourceLanguage/targetLanguage' }) };
    }

    const cmd = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    });
    const res = await translateClient.send(cmd);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ translatedText: res.TranslatedText }),
    };
  } catch (error) {
    console.error('translate-processor error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};


