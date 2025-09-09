import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { transcribeConnection } from './functions/transcribe-connection/resource';
import { websocketHandler } from './functions/websocket-handler/resource';
import { translateProcessor } from './functions/translate-processor/resource';
import { pollyProcessor } from './functions/polly-processor/resource';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  transcribeConnection,
  websocketHandler,
  translateProcessor,
  pollyProcessor,
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

httpApi.addRoutes({
  path: '/translate',
  methods: [HttpMethod.POST],
  integration: new integrations.HttpLambdaIntegration(
    'TranslateProcessorIntegration',
    backend.translateProcessor.resources.lambda
  ),
});

httpApi.addRoutes({
  path: '/synthesize',
  methods: [HttpMethod.POST],
  integration: new integrations.HttpLambdaIntegration(
    'PollyProcessorIntegration',
    backend.pollyProcessor.resources.lambda
  ),
});

backend.addOutput({
  custom: {
    httpApiUrl: httpApi.apiEndpoint,
  },
});

// IAM: allow translate for translate-processor
backend.translateProcessor.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['translate:TranslateText'],
    resources: ['*'],
  })
);

// Set environment variable for storage bucket
(backend.pollyProcessor.resources.lambda as any).addEnvironment('STORAGE_BUCKET', backend.storage.resources.bucket.bucketName);

// IAM: allow polly and S3 for polly-processor
backend.pollyProcessor.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['polly:SynthesizeSpeech'],
    resources: ['*'],
  })
);

backend.pollyProcessor.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  })
);

// Grant Transcribe streaming permissions to the presigning Lambda
backend.transcribeConnection.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['transcribe:StartStreamTranscriptionWebSocket'],
    resources: ['*'],
  })
);
