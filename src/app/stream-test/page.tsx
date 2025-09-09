'use client'

import { useEffect, useRef, useState } from 'react';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { fromUtf8, toUtf8 } from '@smithy/util-utf8';
import outputs from '../../../amplify_outputs.json';

type TranscribeInfo = {
  signedUrl: string;
  connectionParams: { sampleRate: number; mediaEncoding: string };
};

export default function StreamTestPage() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'recording' | 'stopped' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [sourceLang, setSourceLang] = useState<'en' | 'es' | 'fr' | 'de' | 'it' | 'pt'>('en');
  const [targetLang, setTargetLang] = useState<'en' | 'es' | 'fr' | 'de' | 'it' | 'pt'>('es');

  const fetchSignedUrl = async (): Promise<string> => {
    const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
    if (!httpApiUrl) throw new Error('HTTP API URL not found in amplify_outputs.json');
    const res = await fetch(`${httpApiUrl}/transcribe-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceLanguage: sourceLang === 'en' ? 'en-US' : `${targetLang}-US`, targetLanguage: targetLang, userId: 'self' }),
    });
    if (!res.ok) throw new Error(`Lambda error: ${res.status}`);
    const json = await res.json();
    if (!json?.signedUrl) throw new Error('Missing signedUrl in Lambda response');
    return json.signedUrl as string;
  };

  const startFromSignedUrl = async (signedUrl: string, sampleRate = 16000) => {
    setStatus('connecting');
    setLog((p) => [...p, `Connecting to: ${signedUrl}`]);
    
    const ws = new WebSocket(signedUrl, 'aws.transcribe');
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = async () => {
      setLog((p) => [...p, 'WS open']);
      wsRef.current = ws;
      await beginCapture(ws, sampleRate);
    };
    
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        setLog((p) => [...p, `Text: ${e.data}`]);
        return;
      }
      const codec = new EventStreamCodec(toUtf8, fromUtf8);
      try {
        const msg = codec.decode(new Uint8Array(e.data as ArrayBuffer));
        const headers: Record<string, any> = {};
        for (const [k, v] of Object.entries(msg.headers || {})) headers[k] = (v as any).value;
        if (headers[':message-type'] === 'event' && headers[':event-type'] === 'TranscriptEvent') {
          const bodyText = new TextDecoder('utf-8').decode(msg.body as Uint8Array);
          setLog((p) => [...p, `TranscriptEvent: ${bodyText}`]);
          try {
            const parsed = JSON.parse(bodyText);
            const results = parsed?.Transcript?.Results as any[] | undefined;
            if (Array.isArray(results)) {
              for (const r of results) {
                const alt = r?.Alternatives?.[0];
                const txt = alt?.Transcript ?? '';
                if (r?.IsPartial) {
                  setPartialText(txt);
                } else if (txt) {
                  setPartialText('');
                  setFinalLines((prev) => [...prev, txt]);
                  // Send final line to translation endpoint
                  void translateFinal(txt);
                }
              }
            }
          } catch {}
        } else if (headers[':message-type'] === 'event') {
          setLog((p) => [...p, `Event ${headers[':event-type'] || 'unknown'} (${(msg.body as Uint8Array)?.byteLength || 0} bytes)`]);
        } else if (headers[':message-type'] === 'exception') {
          const bodyText = new TextDecoder('utf-8').decode(msg.body as Uint8Array);
          setLog((p) => [...p, `Service exception: ${headers[':error-code']}: ${bodyText}`]);
          setStatus('error');
        } else {
          setLog((p) => [...p, `Binary message received (${(e.data as ArrayBuffer).byteLength} bytes)`]);
        }
      } catch {
        setLog((p) => [...p, `Binary message received (${(e.data as ArrayBuffer).byteLength} bytes)`]);
      }
    };
    
    ws.onerror = (ev: Event) => {
      setLog((p) => [...p, `WS error: ${ev.type}`]);
      setStatus('error');
    };
    
    ws.onclose = (ev: CloseEvent) => {
      setLog((p) => [...p, `WS closed: code=${ev.code} reason=${ev.reason}`]);
      setStatus('stopped');
      cleanup();
    };
  };

  const translateFinal = async (text: string) => {
    try {
      const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
      if (!httpApiUrl) throw new Error('HTTP API URL not found');
      
      // Step 1: Basic translation
      const res = await fetch(`${httpApiUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLanguage: sourceLang, targetLanguage: targetLang })
      });
      if (!res.ok) throw new Error(`Translate error ${res.status}`);
      const json = await res.json();
      
      if (json?.translatedText) {
        // Step 2: Enhance with Bedrock AI for medical accuracy
        const enhanceRes = await fetch(`${httpApiUrl}/enhance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            translatedText: json.translatedText, 
            sourceLanguage: sourceLang, 
            targetLanguage: targetLang,
            originalText: text
          })
        });
        
        let finalText = json.translatedText;
        if (enhanceRes.ok) {
          const enhanceJson = await enhanceRes.json();
          if (enhanceJson?.enhancedText) {
            finalText = enhanceJson.enhancedText;
            setLog((p) => [...p, `Enhanced: ${json.translatedText} → ${finalText}`]);
          }
        } else {
          setLog((p) => [...p, `Enhancement failed, using basic translation`]);
        }
        
        setTranslations((prev) => [...prev, finalText]);
        // Synthesize speech for the enhanced translation
        await synthesizeSpeech(finalText);
      }
    } catch (e: any) {
      setLog((p) => [...p, `Translate failed: ${e?.message || e}`]);
    }
  };

  const synthesizeSpeech = async (text: string) => {
    try {
      const httpApiUrl = (outputs as any)?.custom?.httpApiUrl as string | undefined;
      if (!httpApiUrl) throw new Error('HTTP API URL not found');
      const res = await fetch(`${httpApiUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: targetLang })
      });
      if (!res.ok) throw new Error(`Synthesize error ${res.status}`);
      const json = await res.json();
      if (json?.audioUrl) {
        setAudioUrls((prev) => [...prev, json.audioUrl as string]);
        // Auto-play the audio
        const audio = new Audio(json.audioUrl);
        audio.play().catch(e => setLog((p) => [...p, `Audio play failed: ${e}`]));
      }
    } catch (e: any) {
      setLog((p) => [...p, `Synthesize failed: ${e?.message || e}`]);
    }
  };

  const beginCapture = async (ws: WebSocket, sampleRate: number) => {
    try {
      setStatus('recording');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Create AudioContext with default device sample rate to avoid mismatch errors
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      // Connecting to destination is optional; omit to avoid audio playback/feedback
      // Some browsers require a connection in the graph; if needed, uncomment below
      // processor.connect(audioCtx.destination);

      // Simple energy-based VAD with silence padding
      const vadState = {
        isSpeech: false,
        silenceFrames: 0,
        speechFrames: 0,
      };
      const VAD_THRESHOLD = 0.005; // tune per environment
      const MIN_SPEECH_FRAMES = 3; // debounce speech start
      const MAX_SILENCE_PAD_FRAMES = 6; // send a few silent frames at end

      const codec = new EventStreamCodec(toUtf8, fromUtf8);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Resample from the actual device/context rate to requested sampleRate (default 16k)
        const resampled = resampleTo16k(input, audioCtx.sampleRate, sampleRate);
        // Compute RMS energy
        let sum = 0;
        for (let i = 0; i < resampled.length; i++) {
          const s = resampled[i];
          sum += s * s;
        }
        const rms = Math.sqrt(sum / Math.max(1, resampled.length));

        if (rms > VAD_THRESHOLD) {
          vadState.speechFrames += 1;
          vadState.silenceFrames = 0;
          if (!vadState.isSpeech && vadState.speechFrames >= MIN_SPEECH_FRAMES) {
            vadState.isSpeech = true;
          }
        } else {
          vadState.silenceFrames += 1;
          vadState.speechFrames = 0;
        }

        // During speech, send frames; after speech ends, pad with some silence per AWS guidance
        const shouldSend = vadState.isSpeech || vadState.silenceFrames <= MAX_SILENCE_PAD_FRAMES;

        if (shouldSend) {
          const audioEvent = createAudioEvent(codec, floatTo16BitPCM(resampled));
          ws.send(audioEvent);
        }

        if (vadState.isSpeech && vadState.silenceFrames > MAX_SILENCE_PAD_FRAMES) {
          vadState.isSpeech = false;
        }
      };
      
      setLog((p) => [...p, `Recording started (device ${audioCtx.sampleRate}Hz → ${sampleRate}Hz)`]);
    } catch (error) {
      setLog((p) => [...p, `Microphone error: ${error}`]);
      setStatus('error');
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

  function resampleTo16k(input: Float32Array, srcRate: number, dstRate: number): Float32Array {
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
  }

  const cleanup = () => {
    wsRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const stop = () => {
    wsRef.current?.close();
    cleanup();
    setStatus('stopped');
  };

  useEffect(() => {
    setLog((p) => [...p, 'Click Connect to request a signed URL and start streaming.']);
    return cleanup;
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Transcribe Stream Test</h1>
      <div className="flex gap-2 items-center">
        <select className="border p-2 rounded" value={sourceLang} onChange={(e) => setSourceLang(e.target.value as any)}>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
        </select>
        <span>→</span>
        <select className="border p-2 rounded" value={targetLang} onChange={(e) => setTargetLang(e.target.value as any)}>
          <option value="es">Spanish</option>
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
        </select>
        <button 
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400" 
          onClick={async () => {
            if (connecting) return;
            setConnecting(true);
            try {
              const url = await fetchSignedUrl();
              await startFromSignedUrl(url);
            } catch (e: any) {
              setLog((p) => [...p, `Failed to get signed URL: ${e?.message || e}`]);
              setStatus('error');
            } finally {
              setConnecting(false);
            }
          }} 
          disabled={status === 'recording' || connecting}
        >
          {connecting ? 'Connecting...' : 'Connect & Stream'}
        </button>
        <button 
          className="px-3 py-2 bg-gray-700 text-white rounded" 
          onClick={stop}
          disabled={status === 'idle'}
        >
          Stop
        </button>
      </div>
      <div className="bg-black-100 p-3 rounded text-sm h-64 overflow-auto">
        {log.map((l, i) => (
          <div key={i} className="mb-1">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-medium mb-1">Partial</h2>
          <div className="border rounded p-2 min-h-16 text-sm text-gray-700 whitespace-pre-wrap">{partialText}</div>
        </div>
        <div>
          <h2 className="font-medium mb-1">Final Transcript</h2>
          <div className="border rounded p-2 min-h-16 text-sm text-gray-800 whitespace-pre-wrap">
            {finalLines.map((line, idx) => (
              <div key={idx} className="mb-1">{line}</div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-medium mb-1">Translations</h2>
          <div className="border rounded p-2 min-h-16 text-sm text-gray-800 whitespace-pre-wrap">
            {translations.map((line, idx) => (
              <div key={idx} className="mb-1 flex items-center gap-2">
                <span>{line}</span>
                {audioUrls[idx] && (
                  <button
                    onClick={() => new Audio(audioUrls[idx]).play()}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    🔊
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-sm">
        <p><strong>Status:</strong> {status}</p>
        <p className="text-xs text-gray-600 mt-2">
          This implements AWS Transcribe Streaming WebSocket protocol with proper event stream formatting.
        </p>
      </div>
    </div>
  );
}
