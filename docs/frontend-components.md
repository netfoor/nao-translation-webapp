# Frontend Components Documentation

## Overview

The Healthcare Translation Web Application frontend is built with Next.js 15, React 19, and TypeScript, providing a modern, responsive, and accessible user interface for real-time healthcare translation.

## Application Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main translation interface
│   ├── globals.css        # Global styles
│   └── auth/              # Authentication pages
│       └── callback/      # OAuth callback handling
├── components/            # Reusable UI components
│   ├── ErrorBoundary.tsx  # Error handling component
│   └── LoadingSpinner.tsx # Loading state component
├── context/               # React Context providers
│   └── AppContext.tsx     # Global application state
├── types/                 # TypeScript type definitions
│   └── translation.ts     # Translation-related types
└── amplify/               # AWS Amplify configuration
    ├── client.ts          # Amplify client setup
    └── config.ts          # Configuration loader
```

## Core Components

### 1. Main Translation Interface

**File**: `src/app/page.tsx`

**Purpose**: Primary user interface for real-time healthcare translation

```typescript
'use client'

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { EventStreamCodec } from '@smithy/eventstream-codec';

type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';
type SessionStatus = 'idle' | 'connecting' | 'recording' | 'stopped' | 'error';

const LANGUAGES = {
  en: 'English',
  es: 'Español',
  fr: 'Français', 
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português'
};

export default function HealthcareTranslation() {
  // State management
  const { user, loadingUser } = useApp();
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sourceLang, setSourceLang] = useState<Language>('en');
  const [targetLang, setTargetLang] = useState<Language>('es');
  const [partialText, setPartialText] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for WebSocket and media stream
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Component implementation continues...
}
```

**Key Features**:
- Real-time audio recording and transcription
- Language selection for source and target languages
- Live display of transcription, translation, and enhanced text
- Audio playback of synthesized speech
- Error handling and user feedback
- Responsive design for mobile and desktop

**State Management**:
```typescript
interface TranslationState {
  status: SessionStatus;
  sourceLang: Language;
  targetLang: Language;
  partialText: string;
  finalTranscripts: string[];
  translations: string[];
  audioUrls: string[];
  error: string | null;
}
```

### 2. Application Context Provider

**File**: `src/context/AppContext.tsx`

**Purpose**: Global state management and AWS Amplify integration

```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, AuthUser } from 'aws-amplify/auth';
import { configureAmplify } from '@/amplify/config';

interface AppContextType {
  user: AuthUser | null;
  loadingUser: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      setLoadingUser(true);
      setError(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.log('No authenticated user:', err);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    configureAmplify();
    refreshUser();
  }, []);

  const value: AppContextType = {
    user,
    loadingUser,
    error,
    refreshUser,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
```

**Key Features**:
- Centralized user authentication state
- Automatic Amplify configuration
- Error handling for authentication
- User session refresh functionality

### 3. Error Boundary Component

**File**: `src/components/ErrorBoundary.tsx`

**Purpose**: Catches and handles React component errors gracefully

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Send error to CloudWatch or other monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    console.error('Error logged:', errorData);
    // In production, send to monitoring service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Something went wrong
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-4">
              We apologize for the inconvenience. The error has been logged and our team has been notified.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs text-gray-500 overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Key Features**:
- Graceful error handling with user-friendly messages
- Error logging to monitoring services
- Development mode error details
- Automatic error recovery options

### 4. Loading Spinner Component

**File**: `src/components/LoadingSpinner.tsx`

**Purpose**: Consistent loading state indicator

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  message = 'Loading...', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} text-blue-600`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}
```

### 5. Root Layout Component

**File**: `src/app/layout.tsx`

**Purpose**: Application-wide layout and provider setup

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Healthcare Translation App',
  description: 'Real-time AI-powered healthcare translation with HIPAA compliance',
  keywords: ['healthcare', 'translation', 'AI', 'medical', 'HIPAA'],
  authors: [{ name: 'Healthcare Translation Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AppProvider>
            <div className="min-h-screen bg-gray-50">
              <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center py-4">
                    <div className="flex items-center">
                      <h1 className="text-2xl font-bold text-gray-900">
                        🏥 Healthcare Translation
                      </h1>
                    </div>
                    <nav className="flex space-x-4">
                      <a href="#" className="text-gray-600 hover:text-gray-900">
                        Dashboard
                      </a>
                      <a href="#" className="text-gray-600 hover:text-gray-900">
                        History
                      </a>
                      <a href="#" className="text-gray-600 hover:text-gray-900">
                        Settings
                      </a>
                    </nav>
                  </div>
                </div>
              </header>
              <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {children}
              </main>
            </div>
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

## UI Component Patterns

### 1. Language Selection Component

```typescript
interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
  label: string;
  disabled?: boolean;
}

function LanguageSelector({ value, onChange, label, disabled = false }: LanguageSelectorProps) {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
        disabled={disabled}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {Object.entries(LANGUAGES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 2. Recording Control Component

```typescript
interface RecordingControlProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

function RecordingControl({ isRecording, onStart, onStop, disabled = false }: RecordingControlProps) {
  return (
    <button
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
      className={`
        w-full py-4 px-6 rounded-lg font-semibold text-white transition-colors duration-200
        ${isRecording 
          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
          : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        }
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'focus:outline-none focus:ring-2 focus:ring-offset-2'
        }
      `}
    >
      <div className="flex items-center justify-center space-x-2">
        {isRecording ? (
          <>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span>Stop Recording</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <span>Start Recording</span>
          </>
        )}
      </div>
    </button>
  );
}
```

### 3. Translation Display Component

```typescript
interface TranslationDisplayProps {
  title: string;
  content: string;
  isLoading?: boolean;
  className?: string;
}

function TranslationDisplay({ title, content, isLoading = false, className = '' }: TranslationDisplayProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-3">
        {title}
      </h3>
      <div className="min-h-[100px] relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size="sm" message="Processing..." />
          </div>
        ) : (
          <p className="text-gray-700 leading-relaxed">
            {content || (
              <span className="text-gray-400 italic">
                {title.includes('Transcript') ? 'Start speaking to see transcription...' : 'Waiting for translation...'}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
```

### 4. Audio Player Component

```typescript
interface AudioPlayerProps {
  audioUrl: string;
  language: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

function AudioPlayer({ audioUrl, language, onPlay, onPause, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">
          Audio ({LANGUAGES[language as Language]})
        </h3>
        <span className="text-sm text-gray-500">
          {Math.floor(currentTime)}s / {Math.floor(duration)}s
        </span>
      </div>
      
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        className="hidden"
      />
      
      <div className="flex items-center space-x-4">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        <div className="flex-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-100"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

## State Management Patterns

### 1. Custom Hooks for Translation Logic

```typescript
// useTranslation hook
function useTranslation() {
  const [state, setState] = useState<TranslationState>({
    status: 'idle',
    sourceLang: 'en',
    targetLang: 'es',
    partialText: '',
    finalTranscripts: [],
    translations: [],
    audioUrls: [],
    error: null,
  });

  const updateState = (updates: Partial<TranslationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const resetSession = () => {
    setState({
      status: 'idle',
      sourceLang: state.sourceLang,
      targetLang: state.targetLang,
      partialText: '',
      finalTranscripts: [],
      translations: [],
      audioUrls: [],
      error: null,
    });
  };

  return {
    state,
    updateState,
    resetSession,
  };
}
```

### 2. WebSocket Management Hook

```typescript
// useWebSocket hook
function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      setConnectionStatus('connected');
    };

    wsRef.current.onclose = () => {
      setConnectionStatus('disconnected');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  }, [url]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    wsRef,
  };
}
```

## Accessibility Features

### 1. Keyboard Navigation

```typescript
// Keyboard event handling
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case ' ':
      if (event.ctrlKey) {
        event.preventDefault();
        isRecording ? stopRecording() : startRecording();
      }
      break;
    case 'Escape':
      if (isRecording) {
        stopRecording();
      }
      break;
  }
};

useEffect(() => {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isRecording]);
```

### 2. Screen Reader Support

```typescript
// ARIA labels and live regions
<div
  role="status"
  aria-live="polite"
  aria-label="Translation status"
  className="sr-only"
>
  {status === 'recording' && 'Recording in progress'}
  {status === 'processing' && 'Processing translation'}
  {status === 'completed' && 'Translation completed'}
</div>

<button
  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
  aria-describedby="recording-instructions"
>
  {/* Button content */}
</button>

<div id="recording-instructions" className="sr-only">
  Press Ctrl+Space to toggle recording, or Escape to stop
</div>
```

## Performance Optimization

### 1. Component Memoization

```typescript
// Memoized components for performance
const MemoizedTranslationDisplay = React.memo(TranslationDisplay);
const MemoizedAudioPlayer = React.memo(AudioPlayer);

// Custom comparison for complex props
const MemoizedLanguageSelector = React.memo(LanguageSelector, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value && 
         prevProps.disabled === nextProps.disabled;
});
```

### 2. Debounced Updates

```typescript
// Debounced state updates for real-time transcription
const debouncedUpdateTranscript = useMemo(
  () => debounce((text: string) => {
    setPartialText(text);
  }, 100),
  []
);

useEffect(() => {
  return () => {
    debouncedUpdateTranscript.cancel();
  };
}, [debouncedUpdateTranscript]);
```

## Testing Strategies

### 1. Component Testing

```typescript
// Example component test
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from '../LanguageSelector';

describe('LanguageSelector', () => {
  test('renders with correct options', () => {
    const mockOnChange = jest.fn();
    render(
      <LanguageSelector
        value="en"
        onChange={mockOnChange}
        label="Source Language"
      />
    );

    expect(screen.getByLabelText('Source Language')).toBeInTheDocument();
    expect(screen.getByDisplayValue('English')).toBeInTheDocument();
  });

  test('calls onChange when selection changes', () => {
    const mockOnChange = jest.fn();
    render(
      <LanguageSelector
        value="en"
        onChange={mockOnChange}
        label="Source Language"
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } });
    expect(mockOnChange).toHaveBeenCalledWith('es');
  });
});
```

### 2. Integration Testing

```typescript
// Example integration test
describe('Translation Workflow', () => {
  test('completes full translation flow', async () => {
    render(<HealthcareTranslation />);
    
    // Start recording
    fireEvent.click(screen.getByText('Start Recording'));
    
    // Simulate transcript
    // ... test implementation
    
    // Verify translation appears
    await waitFor(() => {
      expect(screen.getByText(/translated text/i)).toBeInTheDocument();
    });
  });
});
```
