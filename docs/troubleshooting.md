# Troubleshooting Guide

## Overview

This guide provides solutions to common issues you may encounter while developing, deploying, or using the Healthcare Translation Web Application.

## Quick Diagnostics

### System Health Check
```bash
#!/bin/bash
# health-check.sh - Run this script to diagnose common issues

echo "🔍 Healthcare Translation App - Health Check"
echo "============================================"

# Check Node.js version
echo "📦 Node.js Version:"
node --version
echo ""

# Check AWS CLI
echo "☁️ AWS CLI Status:"
aws --version
aws sts get-caller-identity 2>/dev/null && echo "✅ AWS credentials configured" || echo "❌ AWS credentials not found"
echo ""

# Check Amplify status
echo "🚀 Amplify Status:"
npx ampx status 2>/dev/null && echo "✅ Amplify backend deployed" || echo "❌ Amplify backend not found"
echo ""

# Check local server
echo "🌐 Local Development Server:"
curl -s http://localhost:3000 >/dev/null && echo "✅ Local server running" || echo "❌ Local server not running"
echo ""

# Check dependencies
echo "📚 Dependencies:"
npm list --depth=0 2>/dev/null | grep -E "(aws-amplify|next|react)" && echo "✅ Core dependencies installed" || echo "❌ Missing dependencies"
echo ""

echo "Health check complete!"
```

## Common Issues and Solutions

### 1. Authentication Issues

#### Issue: "User is not authenticated"
**Symptoms:**
- Login fails with no error message
- API calls return 401 Unauthorized
- User session expires immediately

**Solutions:**
```typescript
// Check Cognito configuration
import { getCurrentUser } from 'aws-amplify/auth';

const debugAuth = async () => {
  try {
    const user = await getCurrentUser();
    console.log('Current user:', user);
  } catch (error) {
    console.error('Auth error:', error);
    
    // Common fixes:
    // 1. Check if user pool is configured
    // 2. Verify user exists in Cognito
    // 3. Check token expiration
  }
};
```

**Step-by-step fix:**
1. Verify Cognito User Pool exists:
   ```bash
   aws cognito-idp list-user-pools --max-items 10
   ```

2. Check user pool configuration in `amplify_outputs.json`:
   ```json
   {
     "auth": {
       "user_pool_id": "us-east-1_xxxxxxxxx",
       "user_pool_client_id": "xxxxxxxxxxxxxxxxxx"
     }
   }
   ```

3. Clear browser storage and try again:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

#### Issue: "MFA required but not configured"
**Solution:**
```typescript
// Handle MFA in sign-in flow
import { signIn, confirmSignIn } from 'aws-amplify/auth';

const handleSignIn = async (username: string, password: string) => {
  try {
    const result = await signIn({ username, password });
    
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
      // Prompt user for MFA code
      const code = prompt('Enter MFA code:');
      await confirmSignIn({ challengeResponse: code });
    }
  } catch (error) {
    console.error('Sign in error:', error);
  }
};
```

### 2. API Connection Issues

#### Issue: "API Gateway timeout" or "502 Bad Gateway"
**Symptoms:**
- API calls hang or timeout
- Intermittent 502/503 errors
- Lambda cold start delays

**Solutions:**
1. **Check Lambda function logs:**
   ```bash
   # View recent logs
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/healthcare-translation"
   
   # Get specific function logs
   aws logs filter-log-events \
     --log-group-name "/aws/lambda/healthcare-translation-translate-processor" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

2. **Increase Lambda timeout:**
   ```typescript
   // In amplify/functions/translate-processor/resource.ts
   export const translateProcessor = defineFunction({
     name: 'translate-processor',
     entry: './handler.ts',
     timeoutSeconds: 60, // Increase from default 30
     memoryMB: 512,     // Increase memory if needed
   });
   ```

3. **Add retry logic:**
   ```typescript
   const apiCallWithRetry = async (url: string, options: RequestInit, maxRetries = 3) => {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         const response = await fetch(url, options);
         if (response.ok) return response;
         
         if (attempt === maxRetries) throw new Error(`API call failed after ${maxRetries} attempts`);
         
         // Exponential backoff
         await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
       } catch (error) {
         if (attempt === maxRetries) throw error;
         await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
       }
     }
   };
   ```

#### Issue: "CORS errors in browser"
**Solution:**
```typescript
// Update API Gateway CORS configuration in amplify/backend.ts
const httpApi = new apigatewayv2.HttpApi(backend.stack, 'TranslationHttpApi', {
  corsPreflight: {
    allowOrigins: ['http://localhost:3000', 'https://yourdomain.com'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date'],
    allowMethods: [
      CorsHttpMethod.OPTIONS,
      CorsHttpMethod.POST,
      CorsHttpMethod.GET,
    ],
    maxAge: cdk.Duration.days(10),
  },
});
```

### 3. WebSocket Connection Issues

#### Issue: "WebSocket connection failed"
**Symptoms:**
- Real-time updates not working
- Connection drops frequently
- "WebSocket is not open" errors

**Solutions:**
1. **Check WebSocket endpoint:**
   ```typescript
   // Verify WebSocket URL format
   const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
   console.log('WebSocket URL:', wsUrl);
   
   // Should be: wss://xxxxxxxxxx.execute-api.region.amazonaws.com/prod
   if (!wsUrl || !wsUrl.startsWith('wss://')) {
     console.error('Invalid WebSocket URL');
   }
   ```

2. **Add connection retry logic:**
   ```typescript
   class RobustWebSocket {
     private ws: WebSocket | null = null;
     private reconnectAttempts = 0;
     private maxReconnectAttempts = 5;
     
     connect(url: string): Promise<void> {
       return new Promise((resolve, reject) => {
         this.ws = new WebSocket(url);
         
         this.ws.onopen = () => {
           console.log('WebSocket connected');
           this.reconnectAttempts = 0;
           resolve();
         };
         
         this.ws.onclose = (event) => {
           console.log('WebSocket closed:', event.code, event.reason);
           this.handleReconnect(url);
         };
         
         this.ws.onerror = (error) => {
           console.error('WebSocket error:', error);
           reject(error);
         };
       });
     }
     
     private handleReconnect(url: string): void {
       if (this.reconnectAttempts < this.maxReconnectAttempts) {
         this.reconnectAttempts++;
         const delay = Math.pow(2, this.reconnectAttempts) * 1000;
         
         setTimeout(() => {
           console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
           this.connect(url);
         }, delay);
       }
     }
   }
   ```

3. **Check WebSocket API deployment:**
   ```bash
   # List WebSocket APIs
   aws apigatewayv2 get-apis --query 'Items[?ProtocolType==`WEBSOCKET`]'
   
   # Check specific API routes
   aws apigatewayv2 get-routes --api-id YOUR_WEBSOCKET_API_ID
   ```

### 4. Audio and Microphone Issues

#### Issue: "Microphone access denied"
**Solutions:**
1. **Check browser permissions:**
   ```javascript
   // Check microphone permissions
   navigator.permissions.query({ name: 'microphone' }).then((result) => {
     console.log('Microphone permission:', result.state);
     if (result.state === 'denied') {
       alert('Please enable microphone access in browser settings');
     }
   });
   ```

2. **Request permissions properly:**
   ```typescript
   const requestMicrophoneAccess = async (): Promise<MediaStream> => {
     try {
       const stream = await navigator.mediaDevices.getUserMedia({
         audio: {
           sampleRate: 16000,
           channelCount: 1,
           echoCancellation: true,
           noiseSuppression: true,
         }
       });
       
       console.log('Microphone access granted');
       return stream;
     } catch (error) {
       console.error('Microphone access denied:', error);
       
       // Provide user-friendly error message
       if (error.name === 'NotAllowedError') {
         throw new Error('Microphone access denied. Please enable microphone permissions.');
       } else if (error.name === 'NotFoundError') {
         throw new Error('No microphone found. Please connect a microphone.');
       } else {
         throw new Error('Failed to access microphone. Please try again.');
       }
     }
   };
   ```

3. **HTTPS requirement:**
   ```bash
   # For local development with HTTPS
   npm run dev -- --experimental-https
   
   # Or use ngrok for HTTPS tunnel
   npx ngrok http 3000
   ```

#### Issue: "Audio playback not working"
**Solutions:**
1. **Check audio URL format:**
   ```typescript
   const playAudio = async (audioUrl: string) => {
     try {
       // Verify URL is accessible
       const response = await fetch(audioUrl, { method: 'HEAD' });
       if (!response.ok) {
         throw new Error(`Audio file not accessible: ${response.status}`);
       }
       
       const audio = new Audio(audioUrl);
       audio.crossOrigin = 'anonymous'; // For CORS
       
       await audio.play();
     } catch (error) {
       console.error('Audio playback failed:', error);
       
       // Fallback: download and play as blob
       const response = await fetch(audioUrl);
       const blob = await response.blob();
       const blobUrl = URL.createObjectURL(blob);
       
       const audio = new Audio(blobUrl);
       await audio.play();
       
       // Clean up blob URL
       audio.onended = () => URL.revokeObjectURL(blobUrl);
     }
   };
   ```

### 5. Translation Service Issues

#### Issue: "Translation service unavailable"
**Symptoms:**
- Translation requests fail
- Empty translation responses
- Service quota exceeded errors

**Solutions:**
1. **Check service quotas:**
   ```bash
   # Check Amazon Translate quotas
   aws service-quotas get-service-quota \
     --service-code translate \
     --quota-code L-7F2B2B1D
   
   # Check current usage
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Translate \
     --metric-name CharacterCount \
     --start-time $(date -d '1 hour ago' --iso-8601) \
     --end-time $(date --iso-8601) \
     --period 3600 \
     --statistics Sum
   ```

2. **Add error handling and fallbacks:**
   ```typescript
   const translateWithFallback = async (text: string, sourceLang: string, targetLang: string) => {
     try {
       // Primary translation service
       const response = await fetch('/api/translate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text, sourceLanguage: sourceLang, targetLanguage: targetLang })
       });
       
       if (!response.ok) {
         throw new Error(`Translation failed: ${response.status}`);
       }
       
       return await response.json();
     } catch (error) {
       console.error('Primary translation failed:', error);
       
       // Fallback: Basic word-by-word translation or cached results
       return await getFallbackTranslation(text, sourceLang, targetLang);
     }
   };
   ```

3. **Implement caching:**
   ```typescript
   const translationCache = new Map<string, string>();
   
   const getCachedTranslation = (text: string, sourceLang: string, targetLang: string): string | null => {
     const key = `${sourceLang}-${targetLang}-${text}`;
     return translationCache.get(key) || null;
   };
   
   const setCachedTranslation = (text: string, sourceLang: string, targetLang: string, translation: string): void => {
     const key = `${sourceLang}-${targetLang}-${text}`;
     translationCache.set(key, translation);
   };
   ```

### 6. Performance Issues

#### Issue: "Slow response times"
**Solutions:**
1. **Optimize Lambda cold starts:**
   ```typescript
   // Keep connections warm
   const keepWarm = {
     translate: new TranslateClient({}),
     bedrock: new BedrockRuntimeClient({}),
     polly: new PollyClient({}),
   };
   
   // Reuse connections across invocations
   export const handler = async (event: any) => {
     // Use pre-initialized clients
     const result = await keepWarm.translate.send(command);
     return result;
   };
   ```

2. **Add performance monitoring:**
   ```typescript
   const performanceMonitor = {
     startTime: Date.now(),
     
     mark(label: string): void {
       const elapsed = Date.now() - this.startTime;
       console.log(`⏱️ ${label}: ${elapsed}ms`);
     },
     
     async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
       const start = Date.now();
       try {
         const result = await fn();
         const elapsed = Date.now() - start;
         console.log(`⏱️ ${label}: ${elapsed}ms`);
         return result;
       } catch (error) {
         const elapsed = Date.now() - start;
         console.error(`❌ ${label} failed after ${elapsed}ms:`, error);
         throw error;
       }
     }
   };
   ```

3. **Implement request batching:**
   ```typescript
   class RequestBatcher {
     private queue: Array<{ text: string; resolve: Function; reject: Function }> = [];
     private timeout: NodeJS.Timeout | null = null;
     
     async translate(text: string): Promise<string> {
       return new Promise((resolve, reject) => {
         this.queue.push({ text, resolve, reject });
         
         if (!this.timeout) {
           this.timeout = setTimeout(() => this.processBatch(), 100);
         }
       });
     }
     
     private async processBatch(): void {
       const batch = this.queue.splice(0);
       this.timeout = null;
       
       try {
         // Process multiple translations in one API call
         const results = await this.batchTranslate(batch.map(item => item.text));
         
         batch.forEach((item, index) => {
           item.resolve(results[index]);
         });
       } catch (error) {
         batch.forEach(item => item.reject(error));
       }
     }
   }
   ```

## Debugging Tools

### 1. Enable Debug Logging
```typescript
// Add to your environment variables
process.env.DEBUG = 'healthcare-translation:*';

// Use debug logging in your code
import debug from 'debug';
const log = debug('healthcare-translation:api');

log('Processing translation request:', { text, sourceLang, targetLang });
```

### 2. AWS X-Ray Tracing
```typescript
// Enable X-Ray tracing in Lambda functions
import AWSXRay from 'aws-xray-sdk-core';
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// Trace custom segments
const segment = AWSXRay.getSegment();
const subsegment = segment.addNewSubsegment('translation-processing');

try {
  // Your code here
  subsegment.close();
} catch (error) {
  subsegment.addError(error);
  subsegment.close();
  throw error;
}
```

### 3. Browser Developer Tools
```javascript
// Add to browser console for debugging
window.debugTranslation = {
  // Log all WebSocket messages
  logWebSocket: true,
  
  // Log all API calls
  logAPI: true,
  
  // Simulate network issues
  simulateLatency: (ms) => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      await new Promise(resolve => setTimeout(resolve, ms));
      return originalFetch(...args);
    };
  }
};
```

## Error Code Reference

### HTTP Status Codes
- **400**: Bad Request - Check request parameters
- **401**: Unauthorized - Check authentication token
- **403**: Forbidden - Check user permissions
- **429**: Too Many Requests - Implement rate limiting
- **500**: Internal Server Error - Check Lambda logs
- **503**: Service Unavailable - Check service health

### Custom Error Codes
```typescript
enum ErrorCodes {
  // Authentication errors
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  
  // Service errors
  TRANSLATE_SERVICE_ERROR = 'TRANSLATE_SERVICE_ERROR',
  TRANSCRIBE_SERVICE_ERROR = 'TRANSCRIBE_SERVICE_ERROR',
  BEDROCK_SERVICE_ERROR = 'BEDROCK_SERVICE_ERROR',
  POLLY_SERVICE_ERROR = 'POLLY_SERVICE_ERROR',
  
  // Client errors
  MICROPHONE_ACCESS_DENIED = 'MICROPHONE_ACCESS_DENIED',
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  AUDIO_PLAYBACK_FAILED = 'AUDIO_PLAYBACK_FAILED',
  
  // Data errors
  INVALID_LANGUAGE_CODE = 'INVALID_LANGUAGE_CODE',
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  UNSUPPORTED_AUDIO_FORMAT = 'UNSUPPORTED_AUDIO_FORMAT',
}
```

## Getting Additional Help

### 1. Enable Verbose Logging
```bash
# Set environment variables for detailed logging
export DEBUG=*
export AWS_SDK_LOAD_CONFIG=1
export AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

# Run your application with verbose output
npm run dev 2>&1 | tee debug.log
```

### 2. Collect System Information
```bash
#!/bin/bash
# collect-debug-info.sh

echo "System Information for Support"
echo "=============================="
echo "Date: $(date)"
echo "OS: $(uname -a)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "AWS CLI: $(aws --version)"
echo ""

echo "Environment Variables:"
env | grep -E "(AWS_|NEXT_PUBLIC_)" | sort
echo ""

echo "Package Versions:"
npm list --depth=0 | grep -E "(aws-amplify|next|react)"
echo ""

echo "Recent Logs:"
tail -50 ~/.aws/cli/cache/* 2>/dev/null || echo "No AWS CLI cache found"
```

### 3. Contact Support
When contacting support, include:
- Error messages and stack traces
- Steps to reproduce the issue
- System information from the debug script
- Relevant log files
- Screenshots or screen recordings

### Support Channels
- **GitHub Issues**: For bug reports and feature requests
- **AWS Support**: For AWS service-related issues
- **Community Forum**: For general questions and discussions
- **Documentation**: Check the full documentation for detailed guides

Remember to remove any sensitive information (tokens, keys, personal data) before sharing logs or debug information.
