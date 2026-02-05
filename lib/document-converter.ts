import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Document Converter Service - Convert between document formats
 */

export interface ConversionResult {
  content: string;
  format: string;
  fileName: string;
  mimeType: string;
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Convert text to Word format (simplified - returns formatted text)
 */
export async function convertToWord(content: string, fileName: string): Promise<ConversionResult> {
  try {
    // Create a simple Word-compatible format
    const wordContent = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <title>${fileName}</title>
  <created>${new Date().toISOString()}</created>
  <body>
    ${content.split('\n').map(line => `<paragraph>${escapeXml(line)}</paragraph>`).join('\n    ')}
  </body>
</document>`;

    return {
      content: wordContent,
      format: 'docx',
      fileName: fileName.replace(/\.[^/.]+$/, '.docx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  } catch (error) {
    console.error('Word conversion error:', error);
    throw new Error(`Failed to convert to Word: ${error}`);
  }
}

/**
 * Convert text to RTF format
 */
export async function convertToRTF(content: string, fileName: string): Promise<ConversionResult> {
  try {
    const rtfContent = `{\\rtf1\\ansi\\ansicpg1252\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\viewkind4\\uc1\\pard\\f0\\fs20 
${content.split('\n').map(line => escapeRtf(line) + '\\par').join('\n')}
}`;

    return {
      content: rtfContent,
      format: 'rtf',
      fileName: fileName.replace(/\.[^/.]+$/, '.rtf'),
      mimeType: 'application/rtf',
    };
  } catch (error) {
    console.error('RTF conversion error:', error);
    throw new Error(`Failed to convert to RTF: ${error}`);
  }
}

/**
 * Convert text to HTML format
 */
export async function convertToHTML(content: string, fileName: string): Promise<ConversionResult> {
  try {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fileName)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
    p { margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(fileName)}</h1>
  <p>Created: ${new Date().toLocaleString('ar-SA')}</p>
  ${content.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('\n  ')}
</body>
</html>`;

    return {
      content: htmlContent,
      format: 'html',
      fileName: fileName.replace(/\.[^/.]+$/, '.html'),
      mimeType: 'text/html',
    };
  } catch (error) {
    console.error('HTML conversion error:', error);
    throw new Error(`Failed to convert to HTML: ${error}`);
  }
}

/**
 * Convert text to PDF (simplified - returns formatted text for PDF generation)
 */
export async function convertToPDF(content: string, fileName: string): Promise<ConversionResult> {
  try {
    // This returns formatted content that can be used with a PDF library
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
BT
/F1 12 Tf
50 750 Td
(${content.substring(0, 100)}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${content.length + 300}
%%EOF`;

    return {
      content: pdfContent,
      format: 'pdf',
      fileName: fileName.replace(/\.[^/.]+$/, '.pdf'),
      mimeType: 'application/pdf',
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to convert to PDF: ${error}`);
  }
}

/**
 * Auto-detect format and convert
 */
export async function autoConvert(content: string, fileName: string, targetFormat: 'word' | 'rtf' | 'html' | 'pdf'): Promise<ConversionResult> {
  try {
    switch (targetFormat.toLowerCase()) {
      case 'word':
      case 'docx':
        return convertToWord(content, fileName);
      case 'rtf':
        return convertToRTF(content, fileName);
      case 'html':
        return convertToHTML(content, fileName);
      case 'pdf':
        return convertToPDF(content, fileName);
      default:
        throw new Error(`Unsupported format: ${targetFormat}`);
    }
  } catch (error) {
    console.error('Auto-convert error:', error);
    throw error;
  }
}

/**
 * Save converted document
 */
export async function saveConvertedDocument(result: ConversionResult): Promise<string> {
  try {
    const documentDir = FileSystem.documentDirectory || '';
    const filePath = `${documentDir}${result.fileName}`;

    await FileSystem.writeAsStringAsync(filePath, result.content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  } catch (error) {
    console.error('Error saving converted document:', error);
    throw error;
  }
}

// Helper functions
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRtf(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
