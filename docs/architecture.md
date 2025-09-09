# System Architecture

## Overview

The Healthcare Translation Web Application follows a serverless, event-driven architecture built on AWS services. The system is designed for real-time performance, HIPAA compliance, and scalability.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser]
        B[Mobile Device]
    end
    
    subgraph "CDN & Security"
        C[CloudFront CDN]
        D[AWS WAF]
    end
    
    subgraph "Frontend"
        E[Next.js Application]
        F[Amplify Hosting]
    end
    
    subgraph "Authentication"
        G[Amazon Cognito]
        H[User Pools]
    end
    
    subgraph "API Layer"
        I[API Gateway HTTP]
        J[WebSocket API]
    end
    
    subgraph "Compute Layer"
        K[Lambda Functions]
        L[Translation Processor]
        M[Bedrock Processor]
        N[Polly Processor]
        O[WebSocket Handler]
    end
    
    subgraph "AI Services"
        P[Amazon Transcribe]
        Q[Amazon Translate]
        R[Amazon Bedrock]
        S[Amazon Polly]
    end
    
    subgraph "Data Layer"
        T[DynamoDB]
        U[S3 Storage]
    end
    
    subgraph "Monitoring & Security"
        V[CloudWatch]
        W[CloudTrail]
        X[KMS Encryption]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    E --> G
    G --> H
    E --> I
    E --> J
    I --> K
    J --> O
    K --> L
    K --> M
    K --> N
    L --> Q
    M --> R
    N --> S
    E --> P
    K --> T
    S --> U
    P --> U
    T --> X
    U --> X
    K --> V
    K --> W
```

## Data Flow Architecture

### Real-time Translation Flow

```mermaid
sequenceDiagram
    participant User as Healthcare Provider
    participant Frontend as Next.js App
    participant Transcribe as Amazon Transcribe
    participant WS as WebSocket API
    participant Lambda as Lambda Functions
    participant Translate as Amazon Translate
    participant Bedrock as Amazon Bedrock
    participant Polly as Amazon Polly
    participant S3 as S3 Storage
    participant DB as DynamoDB

    User->>Frontend: Start Recording
    Frontend->>Transcribe: Stream Audio (Direct Connection)
    Transcribe-->>Frontend: Real-time Transcription
    Frontend->>WS: Send Transcript
    WS->>Lambda: Process Translation Request
    
    Lambda->>DB: Create Session Record
    Lambda->>Translate: Translate Text
    Translate-->>Lambda: Translated Text
    Lambda->>WS: Send Translation Update
    WS-->>Frontend: Real-time Translation
    
    Lambda->>Bedrock: Enhance Translation
    Bedrock-->>Lambda: Enhanced Text
    Lambda->>WS: Send Enhancement Update
    WS-->>Frontend: Enhanced Translation
    
    Lambda->>Polly: Synthesize Speech
    Polly-->>Lambda: Audio Stream
    Lambda->>S3: Store Audio File
    Lambda->>WS: Send Audio URL
    WS-->>Frontend: Audio Playback
    Frontend-->>User: Play Translated Audio
    
    Lambda->>DB: Update Session Status
```

## Component Architecture

### Frontend Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main translation interface
│   └── auth/              # Authentication pages
├── components/            # Reusable UI components
│   ├── ErrorBoundary.tsx  # Error handling
│   └── LoadingSpinner.tsx # Loading states
├── context/               # React Context providers
│   └── AppContext.tsx     # Global application state
├── types/                 # TypeScript type definitions
│   └── translation.ts     # Translation-related types
└── amplify/               # Amplify configuration
    ├── client.ts          # Amplify client setup
    └── config.ts          # Configuration loader
```

### Backend Architecture

```
amplify/
├── backend.ts             # Main backend configuration
├── auth/                  # Authentication resources
│   └── resource.ts        # Cognito configuration
├── data/                  # Database resources
│   └── resource.ts        # DynamoDB schema
├── storage/               # Storage resources
│   └── resource.ts        # S3 bucket configuration
└── functions/             # Lambda functions
    ├── transcribe-connection/  # Transcribe WebSocket handler
    ├── websocket-handler/      # WebSocket connection manager
    ├── translate-processor/    # Translation service
    ├── bedrock-processor/      # AI enhancement service
    └── polly-processor/        # Text-to-speech service
```

## Service Integration Patterns

### 1. Direct Client Integration
- **Amazon Transcribe Streaming**: Direct WebSocket connection from frontend
- **Benefits**: Low latency, real-time streaming, reduced Lambda costs
- **Implementation**: Signed URL generation via Lambda, direct client connection

### 2. API Gateway Integration
- **HTTP API**: RESTful endpoints for translation services
- **WebSocket API**: Real-time communication for coordination
- **Benefits**: Centralized routing, authentication, rate limiting

### 3. Event-Driven Processing
- **Lambda Functions**: Serverless compute for each AI service
- **Benefits**: Auto-scaling, pay-per-use, service isolation
- **Pattern**: Single-purpose functions with clear responsibilities

## Scalability Considerations

### Horizontal Scaling
- **Lambda Concurrency**: Auto-scaling based on demand
- **API Gateway**: Built-in scaling and throttling
- **DynamoDB**: On-demand scaling for read/write capacity

### Performance Optimization
- **CloudFront CDN**: Global content delivery
- **Connection Pooling**: Reuse of AWS service connections
- **Caching**: Strategic caching of translation results

### Cost Optimization
- **Direct Transcribe Connection**: Bypasses Lambda for streaming
- **On-Demand Resources**: Pay-per-use model for all services
- **Efficient Data Storage**: Optimized DynamoDB and S3 usage

## Security Architecture

### Network Security
```mermaid
graph LR
    subgraph "Internet"
        A[User Request]
    end
    
    subgraph "AWS Edge"
        B[CloudFront]
        C[AWS WAF]
    end
    
    subgraph "Application Layer"
        D[API Gateway]
        E[Lambda Functions]
    end
    
    subgraph "Data Layer"
        F[DynamoDB]
        G[S3 Bucket]
    end
    
    subgraph "Encryption"
        H[KMS Keys]
        I[TLS/SSL]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    E --> G
    F --> H
    G --> H
    B --> I
    D --> I
```

### Data Protection Layers
1. **Transport Encryption**: TLS 1.3 for all communications
2. **Application Encryption**: KMS encryption for sensitive data
3. **Storage Encryption**: Encrypted at rest in DynamoDB and S3
4. **Access Control**: IAM roles with least privilege principle

## Monitoring & Observability

### Logging Architecture
```mermaid
graph TD
    A[Application Logs] --> B[CloudWatch Logs]
    C[API Gateway Logs] --> B
    D[Lambda Logs] --> B
    E[WAF Logs] --> B
    
    B --> F[CloudWatch Insights]
    B --> G[Custom Dashboards]
    
    H[CloudTrail] --> I[Audit Logs]
    I --> J[S3 Audit Bucket]
    
    K[X-Ray Tracing] --> L[Performance Analysis]
```

### Metrics Collection
- **Application Metrics**: Custom CloudWatch metrics
- **Infrastructure Metrics**: AWS service metrics
- **Business Metrics**: Translation accuracy, session duration
- **Security Metrics**: Failed authentication attempts, suspicious activity

## Disaster Recovery

### Backup Strategy
- **DynamoDB**: Point-in-time recovery enabled
- **S3**: Cross-region replication for critical audio files
- **Configuration**: Infrastructure as Code for rapid rebuilding

### High Availability
- **Multi-AZ Deployment**: Services deployed across availability zones
- **Auto-Failover**: Built-in AWS service redundancy
- **Health Checks**: Automated monitoring and alerting

## Compliance Architecture

### HIPAA Compliance Features
- **Encryption**: End-to-end encryption of PHI
- **Access Logging**: Complete audit trail of data access
- **Data Retention**: Configurable retention policies
- **User Authentication**: Strong authentication requirements

### Audit Trail
```mermaid
graph LR
    A[User Action] --> B[Application Log]
    B --> C[CloudTrail Event]
    C --> D[S3 Audit Bucket]
    D --> E[Compliance Report]
    
    F[Data Access] --> G[DynamoDB Log]
    G --> H[CloudWatch Event]
    H --> I[Audit Dashboard]
```

## Technology Decisions

### Why Serverless?
- **Scalability**: Automatic scaling based on demand
- **Cost Efficiency**: Pay only for actual usage
- **Maintenance**: Reduced operational overhead
- **Security**: Built-in security features and compliance

### Why Direct Transcribe Connection?
- **Latency**: Eliminates Lambda cold starts for streaming
- **Cost**: Reduces Lambda invocation costs for long sessions
- **Reliability**: Direct connection reduces failure points
- **Performance**: Optimized for real-time audio streaming

### Why Event-Driven Architecture?
- **Decoupling**: Services can evolve independently
- **Resilience**: Failure isolation between components
- **Scalability**: Each service scales based on its own demand
- **Maintainability**: Clear separation of concerns
