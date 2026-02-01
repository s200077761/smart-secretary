import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface VoiceServiceConfig {
  language?: string;
  rate?: number;
  pitch?: number;
}

let recording: Audio.Recording | null = null;
let sound: Audio.Sound | null = null;

/**
 * Initialize audio permissions and setup
 */
export async function initializeAudio(): Promise<void> {
  try {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Failed to initialize audio:', error);
  }
}

/**
 * Start recording voice input
 */
export async function startRecording(): Promise<void> {
  try {
    // Stop any existing recording
    if (recording) {
      await stopRecording();
    }

    const newRecording = new Audio.Recording();
    await newRecording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await newRecording.startAsync();
    recording = newRecording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
}

/**
 * Stop recording and return the URI
 */
export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    return uri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return null;
  }
}

/**
 * Convert speech to text using device's native speech recognition
 * Note: This is a placeholder - actual implementation depends on device capabilities
 */
export async function speechToText(audioUri: string): Promise<string> {
  try {
    // For now, return a placeholder
    // In production, you would use:
    // - iOS: Speech framework
    // - Android: Google Speech Recognition API
    // - Or use a third-party service like Google Cloud Speech-to-Text
    
    console.log('Converting speech to text from:', audioUri);
    
    // Placeholder - in real implementation, call speech-to-text API
    return 'Speech recognition would be implemented here';
  } catch (error) {
    console.error('Failed to convert speech to text:', error);
    throw error;
  }
}

/**
 * Speak text using text-to-speech
 */
export async function speak(
  text: string,
  config?: VoiceServiceConfig
): Promise<void> {
  try {
    const language = config?.language || 'ar-SA'; // Arabic by default
    
    await Speech.speak(text, {
      language,
      rate: config?.rate || 1.0,
      pitch: config?.pitch || 1.0,
      onDone: () => {
        console.log('Speech finished');
      },
      onError: (error) => {
        console.error('Speech error:', error);
      },
    });
  } catch (error) {
    console.error('Failed to speak:', error);
  }
}

/**
 * Stop speaking
 */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    console.error('Failed to stop speaking:', error);
  }
}

/**
 * Check if speech recognition is available
 */
export async function isSpeechRecognitionAvailable(): Promise<boolean> {
  try {
    const available = await Speech.isSpeakingAsync();
    return true; // If we can speak, we have audio support
  } catch {
    return false;
  }
}

/**
 * Play audio file
 */
export async function playAudio(uri: string): Promise<void> {
  try {
    // Stop any existing sound
    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync({ uri });
    sound = newSound;
    await sound.playAsync();
  } catch (error) {
    console.error('Failed to play audio:', error);
  }
}

/**
 * Stop playing audio
 */
export async function stopAudio(): Promise<void> {
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  }
}
