import { APIGatewayProxyHandler } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const { requestContext, body } = event;
  const { connectionId, domainName, stage } = requestContext;
  
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  try {
    if (event.requestContext.eventType === 'CONNECT') {
      // Store connection
      await dynamoClient.send(new PutCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Item: { 
          connectionId, 
          timestamp: Date.now(),
          userId: event.queryStringParameters?.userId || 'anonymous'
        },
      }));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event.requestContext.eventType === 'DISCONNECT') {
      // Remove connection
      await dynamoClient.send(new DeleteCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: { connectionId },
      }));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // Handle transcript from frontend (received from Transcribe Streaming)
    const { transcript, sessionId, sourceLanguage, targetLanguage } = JSON.parse(body || '{}');
    
    if (transcript) {
      // Trigger translation workflow
      await invokeTranslationWorkflow({
        connectionId,
        transcript,
        sessionId,
        sourceLanguage,
        targetLanguage,
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('WebSocket handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Internal Server Error' }) };
  }
};

async function invokeTranslationWorkflow(params: any) {
  // This would invoke the translation Lambda function
  // For now, we'll send a simple response back via WebSocket
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT!,
  });
  
  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: params.connectionId,
      Data: JSON.stringify({
        type: 'translation_started',
        sessionId: params.sessionId,
        message: 'Translation workflow initiated',
      }),
    }));
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
  }
}
