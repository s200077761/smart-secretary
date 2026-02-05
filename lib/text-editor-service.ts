import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Text Editor Service - Text editing, correction, and enhancement
 */

export interface EditResult {
  original: string;
  edited: string;
  changes: string[];
  suggestions: string[];
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Correct spelling and grammar
 */
export async function correctText(text: string): Promise<EditResult> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `Correct all spelling and grammar mistakes in this text. Return ONLY the corrected text without any explanation:\n\n${text}`,
    ]);

    const correctedText = result.response.text();

    return {
      original: text,
      edited: correctedText,
      changes: findDifferences(text, correctedText),
      suggestions: [],
    };
  } catch (error) {
    console.error('Text correction error:', error);
    throw new Error(`Failed to correct text: ${error}`);
  }
}

/**
 * Enhance text quality
 */
export async function enhanceText(text: string): Promise<EditResult> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `Improve the quality of this text by making it more professional, clear, and engaging. Maintain the original meaning. Return ONLY the enhanced text:\n\n${text}`,
    ]);

    const enhancedText = result.response.text();

    return {
      original: text,
      edited: enhancedText,
      changes: findDifferences(text, enhancedText),
      suggestions: ['Text has been enhanced for clarity and professionalism'],
    };
  } catch (error) {
    console.error('Text enhancement error:', error);
    throw new Error(`Failed to enhance text: ${error}`);
  }
}

/**
 * Summarize text
 */
export async function summarizeText(text: string, length: 'short' | 'medium' | 'long' = 'medium'): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const lengthGuide = {
      short: '1-2 sentences',
      medium: '3-5 sentences',
      long: '1 paragraph',
    };

    const result = await model.generateContent([
      `Summarize this text in ${lengthGuide[length]}. Return ONLY the summary:\n\n${text}`,
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Text summarization error:', error);
    throw new Error(`Failed to summarize text: ${error}`);
  }
}

/**
 * Translate text
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `Translate this text to ${targetLanguage}. Return ONLY the translated text:\n\n${text}`,
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Text translation error:', error);
    throw new Error(`Failed to translate text: ${error}`);
  }
}

/**
 * Paraphrase text
 */
export async function paraphraseText(text: string): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `Paraphrase this text while maintaining the original meaning. Return ONLY the paraphrased text:\n\n${text}`,
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Text paraphrasing error:', error);
    throw new Error(`Failed to paraphrase text: ${error}`);
  }
}

/**
 * Generate suggestions for text improvement
 */
export async function getSuggestions(text: string): Promise<string[]> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `Provide 3-5 specific suggestions to improve this text. Return ONLY the suggestions as a numbered list:\n\n${text}`,
    ]);

    const suggestions = result.response.text()
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, ''));

    return suggestions;
  } catch (error) {
    console.error('Suggestions generation error:', error);
    throw new Error(`Failed to generate suggestions: ${error}`);
  }
}

/**
 * Check text for plagiarism (basic check)
 */
export async function checkPlagiarism(text: string): Promise<{ isPlagiarized: boolean; similarity: number }> {
  try {
    // This is a simplified check - in production, use a proper plagiarism API
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const similarity = (uniqueWords.size / words.length) * 100;

    return {
      isPlagiarized: similarity < 40, // Less than 40% unique words might indicate plagiarism
      similarity: Math.round(similarity),
    };
  } catch (error) {
    console.error('Plagiarism check error:', error);
    throw new Error(`Failed to check plagiarism: ${error}`);
  }
}

// Helper function to find differences between two texts
function findDifferences(original: string, edited: string): string[] {
  const changes: string[] = [];
  const originalWords = original.split(/\s+/);
  const editedWords = edited.split(/\s+/);

  for (let i = 0; i < Math.max(originalWords.length, editedWords.length); i++) {
    if (originalWords[i] !== editedWords[i]) {
      changes.push(`Changed: "${originalWords[i]}" → "${editedWords[i]}"`);
    }
  }

  return changes.slice(0, 10); // Return first 10 changes
}
