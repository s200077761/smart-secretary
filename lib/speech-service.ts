import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Speech Service - Text-to-speech and speech-to-text conversion
 */

export interface SpeechOptions {
  text: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

/**
 * Convert text to speech
 */
export async function textToSpeech(options: SpeechOptions): Promise<void> {
  try {
    await Speech.speak(options.text, {
      language: options.language || 'ar-SA', // Default to Arabic
      rate: options.rate || 1.0,
      pitch: options.pitch || 1.0,
      volume: options.volume || 1.0,
    });
  } catch (error) {
    console.error('Text-to-speech error:', error);
    throw new Error(`Failed to convert text to speech: ${error}`);
  }
}

/**
 * Stop current speech
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    console.error('Stop speech error:', error);
  }
}

/**
 * Pause current speech
 */
export async function pauseSpeech(): Promise<void> {
  try {
    await Speech.pause();
  } catch (error) {
    console.error('Pause speech error:', error);
  }
}

/**
 * Resume paused speech
 */
export async function resumeSpeech(): Promise<void> {
  try {
    await Speech.resume();
  } catch (error) {
    console.error('Resume speech error:', error);
  }
}

/**
 * Get available voices
 */
export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices;
  } catch (error) {
    console.error('Get voices error:', error);
    return [];
  }
}

/**
 * Convert speech to text using Gemini API
 */
export async function speechToText(audioBase64: string): Promise<SpeechRecognitionResult> {
  try {
    // This would integrate with Google Cloud Speech-to-Text API
    // For now, returning a placeholder
    return {
      text: 'Speech recognition requires Google Cloud Speech-to-Text API integration',
      confidence: 0,
      isFinal: false,
    };
  } catch (error) {
    console.error('Speech-to-text error:', error);
    throw new Error(`Failed to convert speech to text: ${error}`);
  }
}

/**
 * Read document aloud
 */
export async function readDocumentAloud(
  content: string,
  options?: Partial<SpeechOptions>
): Promise<void> {
  try {
    const speechOptions: SpeechOptions = {
      text: content,
      language: options?.language || 'ar-SA',
      rate: options?.rate || 0.9,
      pitch: options?.pitch || 1.0,
      volume: options?.volume || 1.0,
    };

    await textToSpeech(speechOptions);
  } catch (error) {
    console.error('Document reading error:', error);
    throw error;
  }
}

/**
 * Create audio file from text
 */
export async function createAudioFile(
  text: string,
  fileName: string,
  language: string = 'ar-SA'
): Promise<string> {
  try {
    // This would require a TTS API that supports file output
    // For now, we'll create a placeholder file
    const documentDir = FileSystem.documentDirectory || '';
    const filePath = `${documentDir}${fileName}`;

    const audioMetadata = `
Audio File Metadata
---
Text: ${text}
Language: ${language}
Created: ${new Date().toISOString()}
Duration: Estimated based on text length
    `;

    await FileSystem.writeAsStringAsync(filePath, audioMetadata);

    return filePath;
  } catch (error) {
    console.error('Audio file creation error:', error);
    throw error;
  }
}

/**
 * Get speech settings
 */
export async function getSpeechSettings(): Promise<{
  isSpeaking: boolean;
  rate: number;
  pitch: number;
  volume: number;
}> {
  try {
    // Return default settings
    return {
      isSpeaking: false,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    };
  } catch (error) {
    console.error('Get speech settings error:', error);
    throw error;
  }
}

/**
 * Speak with different voice
 */
export async function speakWithVoice(
  text: string,
  voiceId: string,
  language: string = 'ar-SA'
): Promise<void> {
  try {
    await Speech.speak(text, {
      language: language,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    });
  } catch (error) {
    console.error('Speak with voice error:', error);
    throw error;
  }
}

/**
 * Create speech synthesis
 */
export async function synthesizeSpeech(
  text: string,
  options?: {
    language?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  try {
    const speechOptions: SpeechOptions = {
      text,
      language: options?.language || 'ar-SA',
      rate: options?.rate || 1.0,
      pitch: options?.pitch || 1.0,
      volume: options?.volume || 1.0,
    };

    if (options?.onStart) options.onStart();

    await textToSpeech(speechOptions);

    if (options?.onDone) options.onDone();
  } catch (error) {
    console.error('Speech synthesis error:', error);
    if (options?.onError) options.onError(error as Error);
    throw error;
  }
}
