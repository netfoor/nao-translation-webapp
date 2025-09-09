export type TranslationSessionStatus = 'processing' | 'completed' | 'failed';

export interface TranslationSession {
  id: string;
  sessionId: string;
  userId: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText?: string | null;
  translatedText?: string | null;
  enhancedText?: string | null;
  audioFileUrl?: string | null;
  translatedAudioUrl?: string | null;
  status?: TranslationSessionStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type TranslationLogStep = 'transcribe' | 'translate' | 'enhance' | 'synthesize';

export interface TranslationLog {
  id: string;
  logId: string;
  sessionId: string;
  step?: TranslationLogStep | null;
  input?: string | null;
  output?: string | null;
  processingTime?: number | null;
  timestamp?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}


