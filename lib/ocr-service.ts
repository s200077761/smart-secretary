import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * OCR Service - Optical Character Recognition using Gemini Vision API
 */

export interface OCRResult {
  text: string;
  confidence?: number;
  language?: string;
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Extract text from image using Gemini Vision API
 */
export async function extractTextFromImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<OCRResult> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([
      'Extract all text from this image. Return only the extracted text without any additional commentary.',
      imagePart,
    ]);

    const responseText = result.response.text();

    return {
      text: responseText,
      confidence: 0.95, // Gemini doesn't provide confidence scores
      language: 'auto',
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`Failed to extract text from image: ${error}`);
  }
}

/**
 * Recognize handwriting from image
 */
export async function recognizeHandwriting(imageBase64: string): Promise<OCRResult> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([
      'This image contains handwritten text. Please transcribe all the handwritten text exactly as it appears. Return only the transcribed text.',
      imagePart,
    ]);

    const responseText = result.response.text();

    return {
      text: responseText,
      confidence: 0.85,
      language: 'auto',
    };
  } catch (error) {
    console.error('Handwriting Recognition Error:', error);
    throw new Error(`Failed to recognize handwriting: ${error}`);
  }
}

/**
 * Analyze document image and extract structured data
 */
export async function analyzeDocument(imageBase64: string): Promise<Record<string, any>> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([
      'Analyze this document image and extract all text and structured data. Return the results in a clear, organized format.',
      imagePart,
    ]);

    const responseText = result.response.text();

    return {
      rawText: responseText,
      timestamp: new Date().toISOString(),
      source: 'gemini-vision',
    };
  } catch (error) {
    console.error('Document Analysis Error:', error);
    throw new Error(`Failed to analyze document: ${error}`);
  }
}

/**
 * Correct text extracted from OCR
 */
export async function correctOCRText(ocrText: string): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      `This text was extracted from an image using OCR. Please correct any spelling mistakes, grammar issues, and formatting problems. Return only the corrected text:\n\n${ocrText}`,
    ]);

    return result.response.text();
  } catch (error) {
    console.error('OCR Correction Error:', error);
    throw new Error(`Failed to correct OCR text: ${error}`);
  }
}
