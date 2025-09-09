# Quick Start Guide

## Overview

Get your Healthcare Translation Web Application up and running in under 30 minutes. This guide covers the essential steps to deploy and test the application in a development environment.

## Prerequisites Checklist

- [ ] **Node.js 18+** installed ([Download](https://nodejs.org/))
- [ ] **AWS Account** with admin access
- [ ] **AWS CLI** configured ([Setup Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- [ ] **Git** installed
- [ ] **Modern web browser** (Chrome, Firefox, Safari, Edge)

## 5-Minute Setup

### Step 1: Clone and Install
```bash
# Clone the repository
git clone <your-repository-url>
cd healthcare-translation-app

# Install dependencies
npm install

# Install Amplify CLI globally
npm install -g @aws-amplify/cli@latest
```

### Step 2: Configure AWS
```bash
# Configure AWS credentials (if not already done)
aws configure

# Verify your AWS identity
aws sts get-caller-identity
```

### Step 3: Deploy Backend
```bash
# Initialize and deploy Amplify backend
npx ampx sandbox

# This creates:
# ✅ Authentication (Cognito)
# ✅ Database (DynamoDB)
# ✅ Storage (S3)
# ✅ API endpoints (Lambda + API Gateway)
# ✅ WebSocket API
```

### Step 4: Start Development Server
```bash
# Start the Next.js development server
npm run dev

# Open your browser to http://localhost:3000
```

### Step 5: Test the Application
1. **Sign Up**: Create a new account using the authentication form
2. **Select Languages**: Choose source and target languages
3. **Start Recording**: Click "Start Recording" and speak into your microphone
4. **View Results**: See real-time transcription, translation, and enhanced text
5. **Play Audio**: Listen to the synthesized speech in the target language

## Verification Steps

### ✅ Backend Services Check
```bash
# Check if all services are deployed
npx ampx status

# Expected output:
# ✅ Auth (Cognito User Pool)
# ✅ Data (DynamoDB Tables)
# ✅ Storage (S3 Bucket)
# ✅ Functions (Lambda Functions)
# ✅ APIs (HTTP + WebSocket)
```

### ✅ Frontend Check
Open your browser and verify:
- [ ] Application loads without errors
- [ ] Authentication works (sign up/sign in)
- [ ] Language selection dropdowns are populated
- [ ] Recording button is functional
- [ ] No console errors in browser developer tools

### ✅ API Endpoints Check
```bash
# Test translation endpoint (replace with your actual API URL)
curl -X POST "https://your-api-id.execute-api.us-east-1.amazonaws.com/translate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Hello, how are you?",
    "sourceLanguage": "en",
    "targetLanguage": "es"
  }'

# Expected response:
# {
#   "translatedText": "Hola, ¿cómo estás?",
#   "sourceLanguage": "en",
#   "targetLanguage": "es",
#   "confidence": 0.95
# }
```

## Common Issues and Solutions

### Issue: "AWS credentials not found"
**Solution:**
```bash
# Configure AWS credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

### Issue: "Permission denied" errors
**Solution:**
Ensure your AWS user has the following permissions:
- `AdministratorAccess` (for development)
- Or specific permissions for Amplify, Lambda, DynamoDB, S3, Cognito, etc.

### Issue: "Module not found" errors
**Solution:**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
```

### Issue: Microphone not working
**Solution:**
- Ensure you're using HTTPS (required for microphone access)
- Check browser permissions for microphone access
- Test with different browsers

### Issue: WebSocket connection fails
**Solution:**
```bash
# Check WebSocket endpoint in amplify_outputs.json
cat amplify_outputs.json | grep websocket

# Verify WebSocket API is deployed
aws apigatewayv2 get-apis --query 'Items[?Name==`TranslationWebSocketApi`]'
```

## Next Steps

### 1. Explore Features
- **Multi-language Support**: Test different language combinations
- **AI Enhancement**: Compare original vs. AI-enhanced translations
- **Audio Quality**: Test different voice options and languages
- **Real-time Updates**: Observe live translation updates via WebSocket

### 2. Customize Configuration
Edit `amplify/backend.ts` to customize:
- **Supported Languages**: Add or remove language options
- **Voice Selection**: Configure different Polly voices
- **AI Models**: Switch between different Bedrock models
- **Storage Settings**: Adjust file retention policies

### 3. Add Sample Data
```bash
# Create sample translation sessions for testing
npm run seed-data

# This creates test data in DynamoDB for development
```

### 4. Enable Additional Features
```typescript
// In amplify/backend.ts, uncomment optional features:

// Enable detailed logging
// enableDetailedLogging: true,

// Enable analytics
// enableAnalytics: true,

// Enable additional AI models
// enableMultipleModels: true,
```

## Development Workflow

### Daily Development
```bash
# Start development environment
npm run dev

# In another terminal, watch for backend changes
npx ampx sandbox --watch

# Make changes to code
# Changes are automatically deployed and reflected
```

### Testing Changes
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run linting
npm run lint

# Type checking
npm run type-check
```

### Deploying Changes
```bash
# Deploy backend changes
npx ampx deploy

# Deploy frontend changes (if using Amplify hosting)
git push origin main
```

## Production Deployment

When ready for production:

### 1. Create Production Environment
```bash
# Deploy to production branch
npx ampx deploy --branch main

# Configure custom domain (optional)
npx ampx hosting add-domain your-domain.com
```

### 2. Environment Variables
Create `.env.production`:
```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_LOG_LEVEL=error
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### 3. Security Hardening
- Enable WAF protection
- Configure CloudTrail logging
- Set up monitoring and alerting
- Review IAM permissions

## Useful Commands

### Amplify Commands
```bash
# Check deployment status
npx ampx status

# View logs
npx ampx logs

# Delete sandbox environment
npx ampx sandbox delete

# Generate new outputs
npx ampx generate outputs
```

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

### AWS CLI Commands
```bash
# List Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `healthcare-translation`)]'

# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `Translation`)]'

# View S3 buckets
aws s3 ls | grep healthcare-translation
```

## Getting Help

### Documentation
- [Full Documentation](./README.md)
- [API Reference](./api-documentation.md)
- [Architecture Guide](./architecture.md)
- [Deployment Guide](./deployment.md)

### Troubleshooting
- [Common Issues](./troubleshooting.md)
- [Error Codes](./error-codes.md)
- [Performance Guide](./performance.md)

### Support Channels
- **GitHub Issues**: For bug reports and feature requests
- **AWS Support**: For AWS service-related issues
- **Community Forum**: For general questions and discussions

## Sample Code Snippets

### Basic Translation Test
```typescript
// Test translation functionality
const testTranslation = async () => {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      text: 'The patient has a fever',
      sourceLanguage: 'en',
      targetLanguage: 'es'
    })
  });
  
  const result = await response.json();
  console.log('Translation:', result.translatedText);
};
```

### WebSocket Connection Test
```typescript
// Test WebSocket connection
const testWebSocket = () => {
  const ws = new WebSocket('wss://your-websocket-url/prod');
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ type: 'ping' }));
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
  };
};
```

## Success Metrics

After completing this quick start, you should have:

- [ ] ✅ Working development environment
- [ ] ✅ All AWS services deployed and configured
- [ ] ✅ Frontend application running locally
- [ ] ✅ Authentication system functional
- [ ] ✅ Translation workflow working end-to-end
- [ ] ✅ Real-time features operational
- [ ] ✅ Audio recording and playback working
- [ ] ✅ No critical errors in browser console
- [ ] ✅ API endpoints responding correctly
- [ ] ✅ WebSocket connections established

**Congratulations!** 🎉 Your Healthcare Translation Web Application is now ready for development and testing.

## What's Next?

1. **Explore the codebase** to understand the architecture
2. **Read the full documentation** for detailed information
3. **Customize the application** for your specific needs
4. **Add new features** using the existing patterns
5. **Deploy to production** when ready

For detailed information on any topic, refer to the comprehensive documentation in the `docs/` folder.
