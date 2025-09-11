'use client'

import { useEffect, useRef, useState } from 'react';
import { signInWithRedirect, signOut } from 'aws-amplify/auth';
import { useApp } from '@/context/AppContext';
import { configureAmplify } from '@/amplify/config';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { fromUtf8, toUtf8 } from '@smithy/util-utf8';
import outputs from '../../amplify_outputs.json';

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
  const { user, loadingUser } = useApp();
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sourceLang, setSourceLang] = useState<Language>('en');
  const [targetLang, setTargetLang] = useState<Language>('es');
  const [partialText, setPartialText] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const fetchSignedUrl = async (): Promise<string> => {
    const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
    if (!httpApiUrl) throw new Error('API configuration not found');
    
    const res = await fetch(`${httpApiUrl}/transcribe-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sourceLanguage: sourceLang === 'en' ? 'en-US' : `${sourceLang}-US`, 
        targetLanguage: targetLang, 
        userId: user?.userId || 'anonymous',
        sampleRate: 16000 // Explicitly specify sample rate
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Signed URL fetch failed:', res.status, errorText);
      throw new Error(`Connection failed: ${res.status} - ${errorText}`);
    }
    
    const json = await res.json();
    console.log('Connection response:', json);
    
    if (!json?.signedUrl) throw new Error('Invalid connection response - missing signedUrl');
    return json.signedUrl;
  };

  const translateAndEnhance = async (text: string) => {
    try {
      const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
      if (!httpApiUrl) return;
      
      // Basic translation
      const translateRes = await fetch(`${httpApiUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLanguage: sourceLang, targetLanguage: targetLang })
      });
      
      if (!translateRes.ok) throw new Error('Translation failed');
      const translateJson = await translateRes.json();
      
      if (translateJson?.translatedText) {
        // AI enhancement for medical accuracy
        const enhanceRes = await fetch(`${httpApiUrl}/enhance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            translatedText: translateJson.translatedText, 
            sourceLanguage: sourceLang, 
            targetLanguage: targetLang,
            originalText: text
          })
        });
        
        let finalText = translateJson.translatedText;
        if (enhanceRes.ok) {
          const enhanceJson = await enhanceRes.json();
          if (enhanceJson?.enhancedText) {
            finalText = enhanceJson.enhancedText;
          }
        }
        
        setTranslations(prev => [...prev, finalText]);
        await synthesizeSpeech(finalText);
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  };

  const synthesizeSpeech = async (text: string) => {
    try {
      const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
      if (!httpApiUrl) return;
      
      const res = await fetch(`${httpApiUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: targetLang })
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json?.audioUrl) {
          setAudioUrls(prev => [...prev, json.audioUrl]);
          // Auto-play for immediate feedback
          const audio = new Audio(json.audioUrl);
          audio.play().catch(() => {}); // Ignore autoplay restrictions
        }
      }
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setStatus('connecting');
      
      const signedUrl = await fetchSignedUrl();
      console.log('Connecting to:', signedUrl);
      
      // AWS Transcribe Streaming WebSocket doesn't require a specific subprotocol
      const ws = new WebSocket(signedUrl);
      ws.binaryType = 'arraybuffer';
      
      ws.onopen = async () => {
        wsRef.current = ws;
        await beginAudioCapture(ws);
      };
      
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') return;
        
        const codec = new EventStreamCodec(toUtf8, fromUtf8);
        try {
          const msg = codec.decode(new Uint8Array(e.data));
          const headers: Record<string, any> = {};
          for (const [k, v] of Object.entries(msg.headers || {})) {
            headers[k] = (v as any).value;
          }
          
          if (headers[':message-type'] === 'event' && headers[':event-type'] === 'TranscriptEvent') {
            const bodyText = new TextDecoder('utf-8').decode(msg.body as Uint8Array);
            const parsed = JSON.parse(bodyText);
            const results = parsed?.Transcript?.Results;
            
            if (Array.isArray(results)) {
              for (const result of results) {
                const transcript = result?.Alternatives?.[0]?.Transcript || '';
                if (result?.IsPartial) {
                  setPartialText(transcript);
                } else if (transcript.trim()) {
                  setPartialText('');
                  setFinalTranscripts(prev => [...prev, transcript]);
                  void translateAndEnhance(transcript);
                }
              }
            }
          }
        } catch (err) {
          console.error('Message processing error:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket state:', ws.readyState);
        console.error('WebSocket URL:', ws.url);
        setStatus('error');
        setError('Failed to connect to transcription service. Please check your internet connection and try again.');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        
        // Only log as error for unexpected closures
        if (event.code !== 1000 && event.code !== 1005) { 
          // 1000 = normal closure, 1005 = no status (often browser/user initiated)
          console.error('WebSocket closed unexpectedly:', event.code, event.reason);
        }
        
        setStatus('stopped');
        cleanup();
      };
      
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const beginAudioCapture = async (ws: WebSocket) => {
    try {
      setStatus('recording');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      mediaStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume AudioContext for Chrome
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      const codec = new EventStreamCodec(toUtf8, fromUtf8);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const input = e.inputBuffer.getChannelData(0);
        const resampled = resampleTo16k(input, audioCtx.sampleRate, 16000);
        const audioEvent = createAudioEvent(codec, floatTo16BitPCM(resampled));
        ws.send(audioEvent);
      };
      
    } catch (err: any) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setError('Microphone not supported on this device.');
      } else {
        setError('Microphone access failed. On mobile devices, HTTPS is required for microphone access.');
      }
    }
  };

  const createAudioEvent = (codec: EventStreamCodec, audioPcm16: Uint8Array) => {
    const headers: Record<string, any> = {
      ':message-type': { type: 'string', value: 'event' },
      ':event-type': { type: 'string', value: 'AudioEvent' },
      ':content-type': { type: 'string', value: 'application/octet-stream' },
    };
    return codec.encode({ headers, body: audioPcm16 });
  };

  const floatTo16BitPCM = (input: Float32Array): Uint8Array => {
    const out = new Uint8Array(input.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return out;
  };

  const resampleTo16k = (input: Float32Array, srcRate: number, dstRate: number): Float32Array => {
    if (srcRate === dstRate) return input;
    const ratio = srcRate / dstRate;
    const newLen = Math.round(input.length / ratio);
    const output = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = i * ratio;
      const i1 = Math.floor(idx);
      const i2 = Math.min(i1 + 1, input.length - 1);
      const frac = idx - i1;
      output[i] = input[i1] * (1 - frac) + input[i2] * frac;
    }
    return output;
  };

  const stopRecording = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Close with proper status code for normal closure
      wsRef.current.close(1000, 'User stopped recording');
    } else if (wsRef.current) {
      // Force close if not in open state
      wsRef.current.close();
    }
    cleanup();
  };

  const cleanup = () => {
    // Clean up WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Cleanup');
      }
      wsRef.current = null;
    }
    
    // Clean up media stream
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    // Clean up audio processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
  };

  const playAudio = (index: number) => {
    if (audioUrls[index]) {
      const audio = new Audio(audioUrls[index]);
      audio.play().catch(() => {});
    }
  };

  const clearSession = () => {
    setFinalTranscripts([]);
    setTranslations([]);
    setAudioUrls([]);
    setPartialText('');
    setError(null);
  };

  useEffect(() => {
    configureAmplify();
    
    // Handle browser tab/window closing
    const handleBeforeUnload = () => {
      cleanup();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, []);

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Healthcare Translation</h1>
              <p className="text-gray-600">Real-time medical translation powered by AI</p>
            </div>
            <button
              onClick={() => signInWithRedirect()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign In to Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Healthcare Translation</h1>
            </div>
            <button
              onClick={() => signOut()}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Language Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Language Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label htmlFor="source-lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Speaking
              </label>
              <select
                id="source-lang"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value as Language)}
                disabled={status === 'recording'}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <div>
              <label htmlFor="target-lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Translating to
              </label>
              <select
                id="target-lang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as Language)}
                disabled={status === 'recording'}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-3">
              {status !== 'recording' ? (
                <button
                  onClick={startRecording}
                  disabled={status === 'connecting'}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  {status === 'connecting' ? 'Connecting...' : 'Start Recording'}
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                  Stop Recording
                </button>
              )}
              <button
                onClick={clearSession}
                disabled={status === 'recording'}
                className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                status === 'recording' ? 'bg-red-500 animate-pulse' : 
                status === 'connecting' ? 'bg-yellow-500' : 
                status === 'error' ? 'bg-red-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Dual Transcript Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Original Transcript */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Original ({LANGUAGES[sourceLang]})
              </h3>
            </div>
            <div className="p-4 min-h-96 max-h-96 overflow-y-auto">
              {partialText && (
                <div className="text-gray-500 dark:text-gray-400 italic mb-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {partialText}
                </div>
              )}
              <div className="space-y-2">
                {finalTranscripts.map((transcript, index) => (
                  <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-gray-900 dark:text-gray-100 transcript-text">{transcript}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Translated Transcript */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Translation ({LANGUAGES[targetLang]})
              </h3>
            </div>
            <div className="p-4 min-h-96 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {translations.map((translation, index) => (
                  <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-start justify-between">
                    <p className="text-gray-900 dark:text-gray-100 transcript-text flex-1">{translation}</p>
                    <button
                      onClick={() => playAudio(index)}
                      className="ml-3 p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      aria-label="Play audio"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by AWS AI services • Enhanced with medical terminology • HIPAA compliant</p>
        </div>
      </main>
    </div>
  );
}
