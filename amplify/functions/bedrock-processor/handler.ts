import { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { translatedText, sourceLanguage, targetLanguage, originalText } = JSON.parse(event.body || '{}');
    if (!translatedText || !sourceLanguage || !targetLanguage) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing translatedText/sourceLanguage/targetLanguage' }) };
    }

    const prompt = `You are a medical translation expert. Please review and enhance this medical translation for accuracy and clinical appropriateness.

Original text (${sourceLanguage}): ${originalText || 'Not provided'}
Current translation (${targetLanguage}): ${translatedText}

Please provide an enhanced translation that:
1. Uses precise medical terminology
2. Maintains clinical accuracy
3. Is culturally appropriate for healthcare settings
4. Preserves the original meaning and urgency

Return only the enhanced translation text, no explanations.`;

    const cmd = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const res = await bedrockClient.send(cmd);
    const responseBody = JSON.parse(new TextDecoder().decode(res.body));
    const enhancedText = responseBody.content[0].text;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ enhancedText }),
    };
  } catch (error) {
    console.error('bedrock-processor error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
