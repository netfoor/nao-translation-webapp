# API Documentation

## Overview

The Healthcare Translation Web Application provides both REST APIs and WebSocket APIs for real-time healthcare translation services. All APIs are secured with AWS Cognito authentication and designed for HIPAA compliance.

## Base URLs

- **HTTP API**: `https://{api-id}.execute-api.{region}.amazonaws.com`
- **WebSocket API**: `wss://{api-id}.execute-api.{region}.amazonaws.com/prod`

## Authentication

All API endpoints require authentication using AWS Cognito tokens.

### Authentication Headers
```http
Authorization: Bearer {cognito-jwt-token}
Content-Type: application/json
```

### Getting Authentication Token
```typescript
import { signIn } from 'aws-amplify/auth';

const authResult = await signIn({
  username: 'user@example.com',
  password: 'password123'
});

const token = authResult.signInDetails?.loginId;
```

## REST API Endpoints

### 1. Transcribe Connection

**Endpoint**: `POST /transcribe-connection`

**Purpose**: Generate signed URL for Amazon Transcribe WebSocket connection

**Request Body**:
```json
{
  "sourceLanguage": "en-US",
  "targetLanguage": "es",
  "userId": "user-123"
}
```

**Response**:
```json
{
  "signedUrl": "wss://transcribestreaming.us-east-1.amazonaws.com/stream-transcription-websocket?...",
  "sessionId": "session-1694123456789-abc123"
}
```

**Example Usage**:
```typescript
const response = await fetch('/transcribe-connection', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sourceLanguage: 'en-US',
    targetLanguage: 'es',
    userId: user.userId
  })
});

const { signedUrl, sessionId } = await response.json();
```

**Error Responses**:
```json
{
  "statusCode": 400,
  "error": "Missing required parameters",
  "details": "sourceLanguage and targetLanguage are required"
}
```

### 2. Text Translation

**Endpoint**: `POST /translate`

**Purpose**: Translate text using Amazon Translate

**Request Body**:
```json
{
  "text": "The patient has chest pain",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

**Response**:
```json
{
  "translatedText": "El paciente tiene dolor en el pecho",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "confidence": 0.95
}
```

**Example Usage**:
```typescript
const translateText = async (text: string, sourceLang: string, targetLang: string) => {
  const response = await fetch('/translate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    })
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }

  return await response.json();
};
```

### 3. AI Enhancement

**Endpoint**: `POST /enhance`

**Purpose**: Enhance translation using Amazon Bedrock AI

**Request Body**:
```json
{
  "translatedText": "El paciente tiene dolor en el pecho",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "medicalContext": "Emergency room consultation"
}
```

**Response**:
```json
{
  "enhancedText": "El paciente presenta dolor torácico",
  "originalTranslation": "El paciente tiene dolor en el pecho",
  "improvementNotes": "AI-enhanced for medical accuracy and cultural appropriateness",
  "processingTime": 1694123456789
}
```

**Example Usage**:
```typescript
const enhanceTranslation = async (translatedText: string, sourceLanguage: string, targetLanguage: string, context?: string) => {
  const response = await fetch('/enhance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      translatedText,
      sourceLanguage,
      targetLanguage,
      medicalContext: context
    })
  });

  return await response.json();
};
```

### 4. Speech Synthesis

**Endpoint**: `POST /synthesize`

**Purpose**: Convert text to speech using Amazon Polly

**Request Body**:
```json
{
  "text": "El paciente presenta dolor torácico",
  "targetLanguage": "es",
  "voiceId": "Lupe",
  "sessionId": "session-1694123456789-abc123"
}
```

**Response**:
```json
{
  "audioUrl": "https://bucket.s3.amazonaws.com/translated-audio/session-123-es.mp3",
  "audioKey": "translated-audio/session-123-es.mp3",
  "voice": "Lupe",
  "language": "es",
  "duration": 3,
  "format": "mp3"
}
```

**Example Usage**:
```typescript
const synthesizeSpeech = async (text: string, language: string, sessionId: string) => {
  const response = await fetch('/synthesize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      targetLanguage: language,
      sessionId
    })
  });

  const result = await response.json();
  
  // Play audio
  const audio = new Audio(result.audioUrl);
  await audio.play();
  
  return result;
};
```

## WebSocket API

### Connection

**URL**: `wss://{api-id}.execute-api.{region}.amazonaws.com/prod`

**Authentication**: Include Cognito token in connection query parameters or headers

```typescript
const connectWebSocket = () => {
  const wsUrl = `${websocketEndpoint}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};
```

### Message Types

#### 1. Transcript Message

**Purpose**: Send transcription results to trigger translation workflow

**Client → Server**:
```json
{
  "type": "transcript",
  "data": {
    "transcript": "The patient has chest pain",
    "sessionId": "session-1694123456789-abc123",
    "sourceLanguage": "en",
    "targetLanguage": "es",
    "isPartial": false
  }
}
```

**Server → Client** (Acknowledgment):
```json
{
  "type": "transcript_received",
  "sessionId": "session-1694123456789-abc123",
  "timestamp": 1694123456789
}
```

#### 2. Translation Updates

**Server → Client**:
```json
{
  "type": "translation",
  "sessionId": "session-1694123456789-abc123",
  "translatedText": "El paciente tiene dolor en el pecho",
  "timestamp": 1694123456789
}
```

#### 3. Enhancement Updates

**Server → Client**:
```json
{
  "type": "enhanced",
  "sessionId": "session-1694123456789-abc123",
  "enhancedText": "El paciente presenta dolor torácico",
  "timestamp": 1694123456789
}
```

#### 4. Audio Notifications

**Server → Client**:
```json
{
  "type": "audio",
  "sessionId": "session-1694123456789-abc123",
  "audioUrl": "https://bucket.s3.amazonaws.com/audio/session-123.mp3",
  "language": "es",
  "voice": "Lupe",
  "timestamp": 1694123456789
}
```

#### 5. Processing Status

**Server → Client**:
```json
{
  "type": "processing_started",
  "sessionId": "session-1694123456789-abc123",
  "steps": ["translate", "enhance", "synthesize"],
  "timestamp": 1694123456789
}
```

#### 6. Error Messages

**Server → Client**:
```json
{
  "type": "error",
  "message": "Translation service temporarily unavailable",
  "sessionId": "session-1694123456789-abc123",
  "errorCode": "TRANSLATE_SERVICE_ERROR",
  "timestamp": 1694123456789
}
```

#### 7. Health Check

**Client → Server**:
```json
{
  "type": "ping",
  "timestamp": 1694123456789
}
```

**Server → Client**:
```json
{
  "type": "pong",
  "timestamp": 1694123456789
}
```

### WebSocket Implementation Example

```typescript
class TranslationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'translation':
        this.onTranslation?.(message);
        break;
      case 'enhanced':
        this.onEnhanced?.(message);
        break;
      case 'audio':
        this.onAudio?.(message);
        break;
      case 'error':
        this.onError?.(message);
        break;
      case 'pong':
        console.log('Received pong');
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect(this.currentToken);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.onMaxReconnectAttemptsReached?.();
    }
  }

  // Event handlers (set by client)
  onTranslation?: (message: any) => void;
  onEnhanced?: (message: any) => void;
  onAudio?: (message: any) => void;
  onError?: (message: any) => void;
  onMaxReconnectAttemptsReached?: () => void;
}
```

## Data Models

### Translation Session
```typescript
interface TranslationSession {
  sessionId: string;
  userId: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText?: string;
  translatedText?: string;
  enhancedText?: string;
  audioFileUrl?: string;
  translatedAudioUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Translation Log
```typescript
interface TranslationLog {
  logId: string;
  sessionId: string;
  step: 'transcribe' | 'translate' | 'enhance' | 'synthesize';
  input: string;
  output: string;
  processingTime: number; // milliseconds
  timestamp: string; // ISO 8601
}
```

### Error Response
```typescript
interface ErrorResponse {
  statusCode: number;
  error: string;
  details?: string;
  timestamp: number;
  requestId?: string;
}
```

## Rate Limits

### HTTP API Rate Limits
- **Per User**: 100 requests per minute
- **Per IP**: 1000 requests per minute
- **Burst Limit**: 200 requests per second

### WebSocket Connection Limits
- **Concurrent Connections**: 10 per user
- **Message Rate**: 50 messages per minute per connection
- **Connection Duration**: 8 hours maximum

## Error Codes

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

### Custom Error Codes
```typescript
enum ErrorCodes {
  INVALID_LANGUAGE = 'INVALID_LANGUAGE',
  TRANSCRIBE_SERVICE_ERROR = 'TRANSCRIBE_SERVICE_ERROR',
  TRANSLATE_SERVICE_ERROR = 'TRANSLATE_SERVICE_ERROR',
  BEDROCK_SERVICE_ERROR = 'BEDROCK_SERVICE_ERROR',
  POLLY_SERVICE_ERROR = 'POLLY_SERVICE_ERROR',
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',
  PHI_DETECTED = 'PHI_DETECTED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}
```

## SDK Usage Examples

### Complete Translation Workflow

```typescript
class HealthcareTranslationClient {
  private httpApiUrl: string;
  private websocket: TranslationWebSocket;
  private token: string;

  constructor(apiUrl: string, websocketUrl: string, token: string) {
    this.httpApiUrl = apiUrl;
    this.token = token;
    this.websocket = new TranslationWebSocket();
    this.setupWebSocketHandlers();
  }

  async startTranslationSession(sourceLanguage: string, targetLanguage: string): Promise<string> {
    // Get signed URL for Transcribe
    const response = await fetch(`${this.httpApiUrl}/transcribe-connection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceLanguage,
        targetLanguage,
        userId: this.getCurrentUserId()
      })
    });

    const { signedUrl, sessionId } = await response.json();
    
    // Connect to WebSocket for real-time updates
    await this.websocket.connect(this.token);
    
    // Connect to Transcribe WebSocket
    await this.connectToTranscribe(signedUrl, sessionId);
    
    return sessionId;
  }

  async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const response = await fetch(`${this.httpApiUrl}/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        sourceLanguage,
        targetLanguage
      })
    });

    const result = await response.json();
    return result.translatedText;
  }

  async enhanceTranslation(translatedText: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const response = await fetch(`${this.httpApiUrl}/enhance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        translatedText,
        sourceLanguage,
        targetLanguage
      })
    });

    const result = await response.json();
    return result.enhancedText;
  }

  async synthesizeSpeech(text: string, language: string, sessionId: string): Promise<string> {
    const response = await fetch(`${this.httpApiUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        targetLanguage: language,
        sessionId
      })
    });

    const result = await response.json();
    return result.audioUrl;
  }

  private setupWebSocketHandlers(): void {
    this.websocket.onTranslation = (message) => {
      console.log('Translation received:', message.translatedText);
      this.onTranslationReceived?.(message);
    };

    this.websocket.onEnhanced = (message) => {
      console.log('Enhanced translation received:', message.enhancedText);
      this.onEnhancedReceived?.(message);
    };

    this.websocket.onAudio = (message) => {
      console.log('Audio ready:', message.audioUrl);
      this.onAudioReady?.(message);
    };

    this.websocket.onError = (message) => {
      console.error('WebSocket error:', message);
      this.onError?.(message);
    };
  }

  // Event handlers (set by client)
  onTranslationReceived?: (message: any) => void;
  onEnhancedReceived?: (message: any) => void;
  onAudioReady?: (message: any) => void;
  onError?: (message: any) => void;
}
```

## Testing

### API Testing with Jest

```typescript
describe('Translation API', () => {
  let client: HealthcareTranslationClient;
  
  beforeEach(() => {
    client = new HealthcareTranslationClient(
      process.env.TEST_API_URL!,
      process.env.TEST_WEBSOCKET_URL!,
      process.env.TEST_TOKEN!
    );
  });

  test('should translate text successfully', async () => {
    const result = await client.translateText(
      'The patient has chest pain',
      'en',
      'es'
    );
    
    expect(result).toContain('dolor');
    expect(result).toContain('pecho');
  });

  test('should enhance translation', async () => {
    const originalTranslation = 'El paciente tiene dolor en el pecho';
    const enhanced = await client.enhanceTranslation(
      originalTranslation,
      'en',
      'es'
    );
    
    expect(enhanced).toBeDefined();
    expect(enhanced.length).toBeGreaterThan(0);
  });

  test('should synthesize speech', async () => {
    const audioUrl = await client.synthesizeSpeech(
      'El paciente presenta dolor torácico',
      'es',
      'test-session-123'
    );
    
    expect(audioUrl).toMatch(/^https:\/\/.+\.mp3$/);
  });
});
```

### WebSocket Testing

```typescript
describe('WebSocket API', () => {
  test('should receive real-time translation updates', (done) => {
    const ws = new TranslationWebSocket();
    
    ws.onTranslation = (message) => {
      expect(message.type).toBe('translation');
      expect(message.translatedText).toBeDefined();
      done();
    };
    
    ws.connect(process.env.TEST_TOKEN!).then(() => {
      ws.sendMessage({
        type: 'transcript',
        data: {
          transcript: 'Test transcript',
          sessionId: 'test-session',
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      });
    });
  });
});
```

This comprehensive API documentation provides all the necessary information for developers to integrate with the Healthcare Translation Web Application's APIs, including authentication, request/response formats, error handling, and practical usage examples.
