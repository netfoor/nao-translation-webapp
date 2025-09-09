# Deployment Guide

## Overview

This guide covers the complete deployment process for the Healthcare Translation Web Application, from development environment setup to production deployment on AWS using Amplify Gen 2.

## Prerequisites

### Required Tools
- **Node.js**: Version 18.x or later
- **npm**: Version 9.x or later
- **AWS CLI**: Version 2.x configured with appropriate credentials
- **Git**: For version control
- **TypeScript**: Knowledge of TypeScript development

### AWS Account Requirements
- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- Access to the following AWS services:
  - AWS Amplify
  - Amazon Cognito
  - Amazon DynamoDB
  - Amazon S3
  - AWS Lambda
  - Amazon API Gateway
  - Amazon Transcribe
  - Amazon Translate
  - Amazon Bedrock
  - Amazon Polly

### Permission Requirements
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:*",
        "cognito-idp:*",
        "dynamodb:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "transcribe:*",
        "translate:*",
        "bedrock:*",
        "polly:*",
        "iam:*",
        "cloudformation:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd healthcare-translation-app
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install Amplify CLI globally
npm install -g @aws-amplify/cli@latest
```

### 3. Configure AWS Credentials
```bash
# Configure AWS CLI
aws configure

# Verify configuration
aws sts get-caller-identity
```

## Development Deployment

### 1. Initialize Amplify Backend
```bash
# Initialize Amplify project
npx ampx sandbox

# This will:
# - Create AWS resources in sandbox environment
# - Generate amplify_outputs.json
# - Set up local development environment
```

### 2. Environment Variables
Create `.env.local` file:
```env
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_PROJECT_REGION=us-east-1

# API Endpoints (auto-generated after deployment)
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-id.execute-api.us-east-1.amazonaws.com/prod

# Amplify Configuration (auto-generated)
NEXT_PUBLIC_AMPLIFY_PROJECT_ID=your-project-id
```

### 3. Start Development Server
```bash
# Start Next.js development server
npm run dev

# Application will be available at http://localhost:3000
```

### 4. Verify Development Setup
```bash
# Test API endpoints
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"text":"Hello","sourceLanguage":"en","targetLanguage":"es"}'

# Test WebSocket connection
# Use browser developer tools or WebSocket testing tool
```

## Production Deployment

### 1. Environment Configuration

#### Production Environment Variables
Create `.env.production`:
```env
# Production AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_PROJECT_REGION=us-east-1

# Production API Endpoints
NEXT_PUBLIC_API_URL=https://prod-api-id.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://prod-websocket-id.execute-api.us-east-1.amazonaws.com/prod

# Security Configuration
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_LOG_LEVEL=error
```

#### Amplify Backend Configuration
Update `amplify/backend.ts` for production:
```typescript
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  // ... other resources
});

// Production-specific configurations
if (process.env.NODE_ENV === 'production') {
  // Enable point-in-time recovery for DynamoDB
  backend.data.resources.tables.TranslationSession.pointInTimeRecoveryEnabled = true;
  backend.data.resources.tables.TranslationLog.pointInTimeRecoveryEnabled = true;
  
  // Enable versioning for S3 bucket
  backend.storage.resources.bucket.versioned = true;
  
  // Configure CloudFront distribution
  backend.addOutput({
    custom: {
      cloudFrontDistribution: backend.storage.resources.cfnDistribution.domainName,
    },
  });
}
```

### 2. Deploy to Production

#### Option A: Amplify Console Deployment
```bash
# Connect repository to Amplify Console
npx ampx deploy --branch main

# This will:
# - Create production environment
# - Set up CI/CD pipeline
# - Deploy frontend and backend
# - Configure custom domain (if specified)
```

#### Option B: Manual Deployment
```bash
# Build production bundle
npm run build

# Deploy backend resources
npx ampx deploy --branch production

# Deploy frontend
npx ampx hosting deploy
```

### 3. Post-Deployment Configuration

#### Domain Configuration
```bash
# Add custom domain (optional)
npx ampx hosting add-domain your-domain.com

# Configure SSL certificate
# This is handled automatically by Amplify
```

#### Environment-Specific Settings
```typescript
// amplify/backend/environment.ts
export const environmentConfig = {
  development: {
    logLevel: 'debug',
    enableDetailedMetrics: true,
    corsOrigins: ['http://localhost:3000'],
  },
  production: {
    logLevel: 'error',
    enableDetailedMetrics: false,
    corsOrigins: ['https://your-domain.com'],
    enableWAF: true,
    enableCloudTrail: true,
  },
};
```

## CI/CD Pipeline

### 1. GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Healthcare Translation App

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linting
        run: npm run lint
      
      - name: Type check
        run: npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Deploy to Amplify
        run: |
          npm install -g @aws-amplify/cli@latest
          npx ampx deploy --branch main
```

### 2. Deployment Environments

#### Development Environment
```bash
# Create development branch deployment
npx ampx sandbox --name development

# Environment-specific configuration
export AMPLIFY_ENV=development
```

#### Staging Environment
```bash
# Create staging environment
npx ampx deploy --branch staging

# Run integration tests
npm run test:integration
```

#### Production Environment
```bash
# Deploy to production
npx ampx deploy --branch main

# Run smoke tests
npm run test:smoke
```

## Infrastructure as Code

### 1. CDK Stack Configuration
```typescript
// amplify/backend/infrastructure.ts
import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

export class HealthcareTranslationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // WAF Configuration
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
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
      ],
    });

    // CloudTrail Configuration
    const trail = new cloudtrail.Trail(this, 'AuditTrail', {
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
    });

    // Output important ARNs
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: webAcl.attrArn,
      description: 'WAF Web ACL ARN',
    });
  }
}
```

### 2. Resource Tagging
```typescript
// amplify/backend/tags.ts
export const resourceTags = {
  Project: 'HealthcareTranslation',
  Environment: process.env.AMPLIFY_ENV || 'development',
  Owner: 'HealthcareTeam',
  CostCenter: 'Healthcare-IT',
  Compliance: 'HIPAA',
  DataClassification: 'PHI',
};

// Apply tags to all resources
backend.stack.tags.setTag('Project', resourceTags.Project);
backend.stack.tags.setTag('Environment', resourceTags.Environment);
// ... apply other tags
```

## Monitoring and Alerting

### 1. CloudWatch Dashboards
```typescript
// amplify/backend/monitoring.ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export const createMonitoringDashboard = (stack: cdk.Stack) => {
  const dashboard = new cloudwatch.Dashboard(stack, 'HealthcareTranslationDashboard', {
    dashboardName: 'Healthcare-Translation-Metrics',
  });

  // API Gateway metrics
  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      title: 'API Requests',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: {
            ApiName: 'healthcare-translation-api',
          },
        }),
      ],
    }),
  );

  // Lambda metrics
  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      title: 'Lambda Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          statistic: 'Sum',
        }),
      ],
    }),
  );

  return dashboard;
};
```

### 2. Alarms Configuration
```typescript
// amplify/backend/alarms.ts
export const createAlarms = (stack: cdk.Stack) => {
  // High error rate alarm
  new cloudwatch.Alarm(stack, 'HighErrorRate', {
    metric: new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      statistic: 'Sum',
    }),
    threshold: 10,
    evaluationPeriods: 2,
    alarmDescription: 'High error rate detected',
  });

  // High latency alarm
  new cloudwatch.Alarm(stack, 'HighLatency', {
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      statistic: 'Average',
    }),
    threshold: 5000, // 5 seconds
    evaluationPeriods: 3,
    alarmDescription: 'High API latency detected',
  });
};
```

## Security Configuration

### 1. WAF Rules
```typescript
// amplify/backend/security.ts
export const wafRules = [
  {
    name: 'AWSManagedRulesCommonRuleSet',
    priority: 1,
    overrideAction: { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name: 'AWSManagedRulesCommonRuleSet',
      },
    },
  },
  {
    name: 'AWSManagedRulesKnownBadInputsRuleSet',
    priority: 2,
    overrideAction: { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
      },
    },
  },
  {
    name: 'RateLimitRule',
    priority: 3,
    action: { block: {} },
    statement: {
      rateBasedStatement: {
        limit: 2000,
        aggregateKeyType: 'IP',
      },
    },
  },
];
```

### 2. IAM Policies
```typescript
// amplify/backend/iam.ts
export const createIAMPolicies = (stack: cdk.Stack) => {
  // Lambda execution policy
  const lambdaPolicy = new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'transcribe:StartStreamTranscriptionWebSocket',
          'translate:TranslateText',
          'bedrock:InvokeModel',
          'polly:SynthesizeSpeech',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:GetItem',
          's3:GetObject',
          's3:PutObject',
        ],
        resources: ['*'],
      }),
    ],
  });

  return lambdaPolicy;
};
```

## Backup and Disaster Recovery

### 1. Backup Configuration
```typescript
// amplify/backend/backup.ts
export const configureBackups = (stack: cdk.Stack) => {
  // DynamoDB backup
  const backupPlan = new backup.BackupPlan(stack, 'BackupPlan', {
    backupPlanRules: [
      {
        ruleName: 'DailyBackups',
        scheduleExpression: events.Schedule.cron({
          hour: '2',
          minute: '0',
        }),
        deleteAfter: cdk.Duration.days(30),
      },
    ],
  });

  // S3 cross-region replication
  const replicationBucket = new s3.Bucket(stack, 'ReplicationBucket', {
    bucketName: 'healthcare-translation-backup',
    versioned: true,
    encryption: s3.BucketEncryption.KMS,
  });

  return { backupPlan, replicationBucket };
};
```

### 2. Disaster Recovery Plan
```bash
#!/bin/bash
# disaster-recovery.sh

# 1. Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name TranslationSession-Recovery \
  --backup-arn arn:aws:dynamodb:region:account:table/TranslationSession/backup/backup-id

# 2. Update DNS to point to recovery region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-failover.json

# 3. Deploy application to recovery region
npx ampx deploy --branch main --region us-west-2

# 4. Verify application functionality
npm run test:smoke -- --region us-west-2
```

## Performance Optimization

### 1. CDN Configuration
```typescript
// amplify/backend/cdn.ts
export const configureCDN = (stack: cdk.Stack) => {
  const distribution = new cloudfront.Distribution(stack, 'CDN', {
    defaultBehavior: {
      origin: new origins.S3Origin(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
    },
    additionalBehaviors: {
      '/api/*': {
        origin: new origins.HttpOrigin('api.example.com'),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    },
  });

  return distribution;
};
```

### 2. Lambda Optimization
```typescript
// amplify/functions/optimized-function/resource.ts
export const optimizedFunction = defineFunction({
  name: 'optimized-function',
  entry: './handler.ts',
  runtime: 'nodejs18.x',
  memoryMB: 1024,
  timeoutSeconds: 30,
  environment: {
    NODE_OPTIONS: '--enable-source-maps',
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
  },
});
```

## Troubleshooting

### Common Deployment Issues

#### 1. Permission Errors
```bash
# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::account:user/username \
  --action-names amplify:CreateApp \
  --resource-arns "*"

# Fix: Add required permissions to IAM user/role
```

#### 2. Resource Limits
```bash
# Check service quotas
aws service-quotas get-service-quota \
  --service-code lambda \
  --quota-code L-B99A9384

# Fix: Request quota increase if needed
```

#### 3. Build Failures
```bash
# Clear build cache
rm -rf .next node_modules
npm install
npm run build

# Check build logs
npx ampx status
```

### Deployment Verification

#### 1. Health Checks
```bash
#!/bin/bash
# health-check.sh

# Check API endpoints
curl -f https://api.example.com/health || exit 1

# Check WebSocket connection
wscat -c wss://ws.example.com/prod || exit 1

# Check database connectivity
aws dynamodb describe-table --table-name TranslationSession || exit 1

echo "All health checks passed"
```

#### 2. Integration Tests
```bash
# Run post-deployment tests
npm run test:integration

# Run load tests
npm run test:load

# Run security tests
npm run test:security
```

This comprehensive deployment guide ensures a smooth and secure deployment process for the Healthcare Translation Web Application across different environments while maintaining HIPAA compliance and operational excellence.
