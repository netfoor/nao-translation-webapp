# Real-Time Healthcare Translation Web Application - Implementation Plan

## Project Overview
Build a HIPAA-compliant real-time healthcare translation web application using AWS services with speech-to-text, AI-enhanced translation, and text-to-speech capabilities.

## Architecture Flow (CORRECTED)
Patient/Doctor → Amplify Frontend → **Direct Transcribe Streaming Connection** → WebSocket API → Lambda Handlers → Translate → Bedrock → Polly → **Real-time Response**

**KEY CORRECTION: Frontend connects directly to Amazon Transcribe Streaming API (not through Lambda) due to persistent connection requirements.**

---

✅## Phase 1: Foundation Setup

### Step 1: Initialize AWS Amplify Gen 2 Project
```bash
# Create Next.js project
npx create-next-app@latest healthcare-translator --typescript --tailwind --eslint --app
cd healthcare-translator

# Initialize Amplify Gen 2
npm create amplify@latest
npm install aws-amplify
```

✅**Configure amplify/backend.ts:**
```typescript
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

export const backend = defineBackend({
  auth,
  data,
  storage,
});
```

✅### Step 2: Configure Amazon Cognito Authentication usign Amazon Cognito Hosted IU 
**Create amplify/auth/resource.ts:**
```typescript
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    preferredUsername: {
      required: true,
    }
  },
  groups: ['healthcare_providers', 'patients'],
});
```

✅### Step 3: Configure Amazon S3 Storage
**Create amplify/storage/resource.ts:**
```typescript
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'healthcareTranslationStorage',
  access: (allow) => ({
    'audio-files/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'translated-files/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
```

✅### Step 4: Configure DynamoDB Tables
**Create amplify/data/resource.ts:**
```typescript
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  TranslationSession: a
    .model({
      sessionId: a.id().required(),
      userId: a.string().required(),
      sourceLanguage: a.string().required(),
      targetLanguage: a.string().required(),
      originalText: a.string(),
      translatedText: a.string(),
      enhancedText: a.string(),
      audioFileUrl: a.string(),
      translatedAudioUrl: a.string(),
      status: a.enum(['processing', 'completed', 'failed']),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
    
  TranslationLog: a
    .model({
      logId: a.id().required(),
      sessionId: a.string().required(),
      step: a.enum(['transcribe', 'translate', 'enhance', 'synthesize']),
      input: a.string(),
      output: a.string(),
      processingTime: a.float(),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
```

✅### Step 5: Deploy Foundation
```bash
npx ampx sandbox
```

---

## Phase 2: Backend Lambda Functions

### Step 6: Create Lambda Orchestrator Function
**Create amplify/functions/orchestrator/handler.ts:**
```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const { audioData, sourceLanguage, targetLanguage, userId } = JSON.parse(event.body || '{}');
  
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create session record
  await dynamoClient.send(new PutCommand({
    TableName: process.env.TRANSLATION_SESSION_TABLE,
    Item: {
      sessionId,
      userId,
      sourceLanguage,
      targetLanguage,
      status: 'processing',
      createdAt: new Date().toISOString(),
    },
  }));
  
  // Trigger transcription workflow
  // Implementation continues in next steps
  
  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId, status: 'processing' }),
  };
};
```

### Step 7: Create WebSocket Handler for Coordination
**IMPORTANT: Transcribe Streaming requires persistent connections that Lambda cannot maintain effectively. The frontend will connect directly to Transcribe Streaming API.**

**Create amplify/functions/websocket-handler/handler.ts:**
```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const apiGateway = new ApiGatewayManagementApiClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const { requestContext, body } = event;
  const { connectionId, domainName, stage } = requestContext;
  
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  if (event.requestContext.eventType === 'CONNECT') {
    // Store connection
    await dynamoClient.send(new PutCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: { connectionId, timestamp: Date.now() },
    }));
    return { statusCode: 200 };
  }

  if (event.requestContext.eventType === 'DISCONNECT') {
    // Remove connection
    await dynamoClient.send(new DeleteCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Key: { connectionId },
    }));
    return { statusCode: 200 };
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

  return { statusCode: 200 };
};

async function invokeTranslationWorkflow(params: any) {
  // Invoke translation Lambda
  const lambda = new LambdaClient({});
  await lambda.send(new InvokeCommand({
    FunctionName: process.env.TRANSLATION_WORKFLOW_FUNCTION,
    Payload: JSON.stringify(params),
  }));
}
```

### Step 8: Create Translation Processor
**Create amplify/functions/translate-processor/handler.ts:**
```typescript
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const translateClient = new TranslateClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const { sessionId, text, sourceLanguage, targetLanguage } = event;
  
  const translateCommand = new TranslateTextCommand({
    Text: text,
    SourceLanguageCode: sourceLanguage,
    TargetLanguageCode: targetLanguage,
    Settings: {
      Brevity: 'ON',
      Formality: 'FORMAL',
    },
  });
  
  const result = await translateClient.send(translateCommand);
  
  // Update session with translated text
  await dynamoClient.send(new UpdateCommand({
    TableName: process.env.TRANSLATION_SESSION_TABLE,
    Key: { sessionId },
    UpdateExpression: 'SET translatedText = :text, updatedAt = :timestamp',
    ExpressionAttributeValues: {
      ':text': result.TranslatedText,
      ':timestamp': new Date().toISOString(),
    },
  }));
  
  return {
    sessionId,
    translatedText: result.TranslatedText,
    status: 'translated',
  };
};
```

### Step 9: Create Bedrock AI Enhancement Processor
**Create amplify/functions/bedrock-processor/handler.ts:**
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const bedrockClient = new BedrockRuntimeClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const { sessionId, translatedText, sourceLanguage, targetLanguage } = event;
  
  const prompt = `
  You are a medical translation expert. Please enhance and refine this medical translation for accuracy and clarity:
  
  Original Language: ${sourceLanguage}
  Target Language: ${targetLanguage}
  Translation: ${translatedText}
  
  Please provide an enhanced version that:
  1. Maintains medical accuracy
  2. Uses appropriate medical terminology
  3. Ensures cultural sensitivity
  4. Maintains professional tone
  
  Enhanced translation:`;
  
  const modelInput = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };
  
  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    body: JSON.stringify(modelInput),
  });
  
  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const enhancedText = responseBody.content[0].text;
  
  // Update session with enhanced text
  await dynamoClient.send(new UpdateCommand({
    TableName: process.env.TRANSLATION_SESSION_TABLE,
    Key: { sessionId },
    UpdateExpression: 'SET enhancedText = :text, updatedAt = :timestamp',
    ExpressionAttributeValues: {
      ':text': enhancedText,
      ':timestamp': new Date().toISOString(),
    },
  }));
  
  return {
    sessionId,
    enhancedText,
    status: 'enhanced',
  };
};
```

### Step 10: Create Polly Speech Synthesis Processor
**Create amplify/functions/polly-processor/handler.ts:**
```typescript
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const pollyClient = new PollyClient({});
const s3Client = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const { sessionId, enhancedText, targetLanguage } = event;
  
  // Map language codes to Polly voices
  const voiceMap: { [key: string]: string } = {
    'en': 'Joanna',
    'es': 'Lupe',
    'fr': 'Celine',
    'de': 'Marlene',
    'it': 'Carla',
    'pt': 'Camila',
  };
  
  const voiceId = voiceMap[targetLanguage] || 'Joanna';
  
  const synthesizeCommand = new SynthesizeSpeechCommand({
    Text: enhancedText,
    OutputFormat: 'mp3',
    VoiceId: voiceId,
    Engine: 'neural',
    TextType: 'text',
  });
  
  const audioResult = await pollyClient.send(synthesizeCommand);
  
  // Upload synthesized audio to S3
  const audioKey = `translated-audio/${sessionId}.mp3`;
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET,
    Key: audioKey,
    Body: audioResult.AudioStream,
    ContentType: 'audio/mpeg',
  }));
  
  const audioUrl = `https://${process.env.STORAGE_BUCKET}.s3.amazonaws.com/${audioKey}`;
  
  // Update session with audio URL
  await dynamoClient.send(new UpdateCommand({
    TableName: process.env.TRANSLATION_SESSION_TABLE,
    Key: { sessionId },
    UpdateExpression: 'SET translatedAudioUrl = :url, #status = :status, updatedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':url': audioUrl,
      ':status': 'completed',
      ':timestamp': new Date().toISOString(),
    },
  }));
  
  return {
    sessionId,
    audioUrl,
    status: 'completed',
  };
};
```

---

## Phase 3: API Gateway and Step Functions

### Step 11: Create WebSocket API Gateway
**Create amplify/backend/websocket-api/resource.ts:**
```typescript
import { defineFunction } from '@aws-amplify/backend';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export const websocketHandler = defineFunction({
  name: 'websocket-handler',
  entry: './websocket-handler.ts',
});

export const websocketApi = new apigatewayv2.WebSocketApi(this, 'TranslationWebSocketApi', {
  connectRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', websocketHandler),
  },
  disconnectRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', websocketHandler),
  },
  defaultRouteOptions: {
    integration: new integrations.WebSocketLambdaIntegration('DefaultIntegration', websocketHandler),
  },
});

export const stage = new apigatewayv2.WebSocketStage(this, 'prod', {
  webSocketApi: websocketApi,
  stageName: 'prod',
  autoDeploy: true,
});
```

### Step 12: Create Real-time Translation Workflow
**Create amplify/functions/realtime-workflow/handler.ts:**
```typescript
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const translateClient = new TranslateClient({});
const bedrockClient = new BedrockRuntimeClient({});
const pollyClient = new PollyClient({});

export const handler = async (event: any) => {
  const { connectionId, text, sourceLanguage, targetLanguage, sessionId } = event;
  
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT,
  });

  try {
    // 1. Translate text
    const translateResult = await translateClient.send(new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    }));

    // Send translation update
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'translation',
        sessionId,
        translatedText: translateResult.TranslatedText,
      }),
    }));

    // 2. Enhance with Bedrock
    const enhancePrompt = `Enhance this medical translation: ${translateResult.TranslatedText}`;
    const bedrockResult = await bedrockClient.send(new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [{ role: "user", content: enhancePrompt }]
      }),
    }));

    const enhancedText = JSON.parse(new TextDecoder().decode(bedrockResult.body)).content[0].text;

    // Send enhancement update
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'enhanced',
        sessionId,
        enhancedText,
      }),
    }));

    // 3. Generate speech
    const pollyResult = await pollyClient.send(new SynthesizeSpeechCommand({
      Text: enhancedText,
      OutputFormat: 'mp3',
      VoiceId: 'Joanna',
      Engine: 'neural',
    }));

    // Convert audio to base64 and send
    const audioBuffer = await pollyResult.AudioStream?.transformToByteArray();
    const audioBase64 = Buffer.from(audioBuffer!).toString('base64');

    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'audio',
        sessionId,
        audioData: audioBase64,
      }),
    }));

  } catch (error) {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'error', message: error.message }),
    }));
  }
};
```

---

## Phase 4: Frontend Implementation

### Step 13: Create Real-time Translation Interface (CORRECTED)
**Frontend connects directly to Transcribe Streaming API, then sends results via WebSocket**

**Create app/translate/page.tsx:**
```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';

export default function TranslatePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [enhancedText, setEnhancedText] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const transcribeClientRef = useRef<TranscribeStreamingClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionId = useRef(`session-${Date.now()}`);

  useEffect(() => {
    // Initialize Transcribe client
    transcribeClientRef.current = new TranscribeStreamingClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Connect to WebSocket for coordination
    wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'translation':
          setTranslation(data.translatedText);
          break;
        case 'enhanced':
          setEnhancedText(data.enhancedText);
          break;
        case 'audio':
          playAudio(data.audioData);
          break;
      }
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { sampleRate: 16000, channelCount: 1 } 
    });
    
    // Start Transcribe Streaming
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: sourceLanguage,
      MediaSampleRateHertz: 16000,
      MediaEncoding: 'pcm',
      AudioStream: createAudioStream(stream),
    });

    try {
      const response = await transcribeClientRef.current!.send(command);
      
      // Process streaming results
      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          if (event.TranscriptEvent?.Transcript?.Results) {
            const results = event.TranscriptEvent.Transcript.Results;
            for (const result of results) {
              if (result.Alternatives && result.Alternatives[0]) {
                const transcriptText = result.Alternatives[0].Transcript;
                setTranscript(transcriptText);
                
                if (!result.IsPartial) {
                  // Send final transcript to WebSocket for translation
                  wsRef.current?.send(JSON.stringify({
                    transcript: transcriptText,
                    sessionId: sessionId.current,
                    sourceLanguage,
                    targetLanguage,
                  }));
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Transcription error:', error);
    }

    setIsRecording(true);
  };

  const createAudioStream = (stream: MediaStream) => {
    return async function* () {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=pcm'
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.start(250); // 250ms chunks
      
      while (mediaRecorder.state === 'recording') {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (chunks.length > 0) {
          const chunk = chunks.shift()!;
          const arrayBuffer = await chunk.arrayBuffer();
          yield { AudioEvent: { AudioChunk: new Uint8Array(arrayBuffer) } };
        }
      }
    };
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const playAudio = (audioBase64: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audio.play();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Real-time Healthcare Translation</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <select 
              value={sourceLanguage} 
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
            <select 
              value={targetLanguage} 
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="es">Spanish</option>
              <option value="en">English</option>
            </select>
          </div>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full p-4 rounded-lg font-semibold ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Real-time Recording'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium">Live Transcript:</h3>
            <p className="text-gray-700">{transcript}</p>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium">Translation:</h3>
            <p className="text-gray-700">{translation}</p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium">Enhanced Translation:</h3>
            <p className="text-gray-700">{enhancedText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 5: Security and Compliance

### Step 14: Configure AWS WAF
**Create amplify/backend/waf/resource.ts:**
```typescript
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export const wafAcl = new wafv2.CfnWebACL(this, 'HealthcareTranslationWAF', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    {
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      action: { block: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRule',
      },
    },
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 2,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CommonRuleSetMetric',
      },
    },
  ],
});
```

### Step 15: Configure KMS Encryption
**Create amplify/backend/kms/resource.ts:**
```typescript
import * as kms from 'aws-cdk-lib/aws-kms';

export const encryptionKey = new kms.Key(this, 'HealthcareTranslationKey', {
  description: 'KMS key for healthcare translation application',
  enableKeyRotation: true,
  policy: new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      }),
    ],
  }),
});
```

### Step 16: Configure CloudTrail Logging
**Create amplify/backend/cloudtrail/resource.ts:**
```typescript
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';

const auditBucket = new s3.Bucket(this, 'AuditLogsBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: encryptionKey,
  versioned: true,
  lifecycleRules: [{
    id: 'DeleteOldLogs',
    expiration: Duration.days(2555), // 7 years for HIPAA compliance
  }],
});

export const trail = new cloudtrail.Trail(this, 'HealthcareTranslationTrail', {
  bucket: auditBucket,
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
  enableFileValidation: true,
});
```

---

## Phase 6: Deployment and Testing

### Step 17: Environment Configuration
**Create amplify/backend/environment.ts:**
```typescript
export const environment = {
  production: {
    TRANSCRIBE_MEDICAL_VOCABULARY: 'medical-terms-vocab',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
    ENCRYPTION_KEY_ID: encryptionKey.keyId,
    AUDIT_BUCKET: auditBucket.bucketName,
  },
  development: {
    TRANSCRIBE_MEDICAL_VOCABULARY: 'medical-terms-vocab-dev',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
    ENCRYPTION_KEY_ID: encryptionKey.keyId,
    AUDIT_BUCKET: auditBucket.bucketName,
  },
};
```

### Step 18: Deploy Complete Application
```bash
# Deploy backend
npx ampx sandbox

# Build and deploy frontend
npm run build
npx ampx deploy --branch main
```

### Step 19: Configure IAM Permissions
**Create amplify/backend/iam/policies.ts:**
```typescript
const lambdaExecutionPolicy = new iam.PolicyDocument({
  statements: [
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'transcribe:StartTranscriptionJob',
        'transcribe:GetTranscriptionJob',
        'translate:TranslateText',
        'bedrock:InvokeModel',
        'polly:SynthesizeSpeech',
        's3:GetObject',
        's3:PutObject',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'kms:Decrypt',
        'kms:Encrypt',
        'kms:GenerateDataKey',
      ],
      resources: ['*'],
    }),
  ],
});
```

### Step 20: Testing and Validation
**Create test scripts:**
```bash
# Test authentication
npm run test:auth

# Test translation workflow
npm run test:translation

# Test HIPAA compliance
npm run test:compliance

# Load testing
npm run test:load
```

---

## Phase 7: Monitoring and Maintenance

### Step 21: Configure CloudWatch Monitoring
- Set up dashboards for translation metrics
- Configure alarms for error rates and latency
- Monitor HIPAA compliance metrics

### Step 22: Set Up Backup and Recovery
- Configure automated DynamoDB backups
- Set up S3 cross-region replication
- Create disaster recovery procedures

---

## Deployment Commands Summary

```bash
# Initial setup
npx create-next-app@latest healthcare-translator --typescript --tailwind --eslint --app
cd healthcare-translator
npm create amplify@latest

# Install dependencies
npm install aws-amplify @aws-sdk/client-transcribe-streaming @aws-sdk/client-translate @aws-sdk/client-bedrock-runtime @aws-sdk/client-polly @aws-sdk/client-apigatewaymanagementapi

# Deploy to sandbox
npx ampx sandbox

# Deploy to production
npx ampx deploy --branch main
```

## Key Features Implemented

✅ **Real-time speech-to-text** with Amazon Transcribe Streaming API
✅ **WebSocket-based real-time communication**
✅ **Medical-grade translation** with Amazon Translate
✅ **AI enhancement** with Amazon Bedrock
✅ **Natural speech synthesis** with Amazon Polly
✅ **HIPAA-compliant architecture** with encryption and audit logging
✅ **Serverless scalability** with Lambda and WebSocket API
✅ **Secure authentication** with Cognito
✅ **Web application firewall** protection
✅ **Comprehensive monitoring** and logging

This plan provides a complete implementation roadmap for your Real-Time Healthcare Translation Web Application following the exact architecture diagram provided.
