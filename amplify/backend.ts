import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { transcribeConnection } from './functions/transcribe-connection/resource';
import { websocketHandler } from './functions/websocket-handler/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  transcribeConnection,
  websocketHandler,
});

// Add WebSocket API using CDK
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { CorsHttpMethod, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';

const websocketApi = new apigatewayv2.WebSocketApi(backend.stack, 'TranslationWebSocketApi', {
  connectRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', backend.websocketHandler.resources.lambda),
  },
  disconnectRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', backend.websocketHandler.resources.lambda),
  },
  defaultRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('DefaultIntegration', backend.websocketHandler.resources.lambda),
  },
});

const stage = new apigatewayv2.WebSocketStage(backend.stack, 'prod', {
  webSocketApi: websocketApi,
  stageName: 'prod',
  autoDeploy: true,
});

// Export the WebSocket endpoint for use in other functions
backend.addOutput({
  custom: {
    websocketEndpoint: `wss://${websocketApi.apiId}.execute-api.${backend.stack.region}.amazonaws.com/prod`,
  },
});

// HTTP API for invoking transcribe-connection Lambda
const httpApi = new apigatewayv2.HttpApi(backend.stack, 'TranslationHttpApi', {
  apiName: 'translation-http-api',
  corsPreflight: {
    allowOrigins: ['*'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: [
      CorsHttpMethod.OPTIONS,
      CorsHttpMethod.POST,
    ],
  },
});

httpApi.addRoutes({
  path: '/transcribe-connection',
  methods: [HttpMethod.POST],
  integration: new integrations.HttpLambdaIntegration(
    'TranscribeConnectionIntegration',
    backend.transcribeConnection.resources.lambda
  ),
});

backend.addOutput({
  custom: {
    httpApiUrl: httpApi.apiEndpoint,
  },
});
