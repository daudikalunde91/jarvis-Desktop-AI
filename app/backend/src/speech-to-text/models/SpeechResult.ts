export interface SpeechResult {
  sessionId: string;
  text: string;
  confidence: number | null;
  isFinal: boolean;
  language: string | null;
  timestamp: number;
}
