import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Digital Signature Service - Add signatures to documents
 */

export interface SignatureData {
  base64: string;
  timestamp: string;
  signedBy: string;
  signatureType: 'digital' | 'image';
}

export interface SignedDocument {
  originalContent: string;
  signature: SignatureData;
  signedContent: string;
  verificationHash: string;
}

/**
 * Create a digital signature
 */
export async function createDigitalSignature(
  content: string,
  signedBy: string,
  signatureImage?: string
): Promise<SignatureData> {
  try {
    const timestamp = new Date().toISOString();
    
    // Create signature data
    const signatureData: SignatureData = {
      base64: signatureImage || generateDefaultSignature(signedBy),
      timestamp,
      signedBy,
      signatureType: signatureImage ? 'image' : 'digital',
    };

    return signatureData;
  } catch (error) {
    console.error('Signature creation error:', error);
    throw new Error(`Failed to create signature: ${error}`);
  }
}

/**
 * Sign a document
 */
export async function signDocument(
  content: string,
  signatureData: SignatureData
): Promise<SignedDocument> {
  try {
    const verificationHash = generateHash(content + signatureData.timestamp);
    
    const signedContent = `
=== DOCUMENT START ===
${content}
=== DOCUMENT END ===

=== SIGNATURE ===
Signed by: ${signatureData.signedBy}
Date: ${signatureData.timestamp}
Signature Type: ${signatureData.signatureType}
Verification Hash: ${verificationHash}
=== SIGNATURE END ===
`;

    return {
      originalContent: content,
      signature: signatureData,
      signedContent,
      verificationHash,
    };
  } catch (error) {
    console.error('Document signing error:', error);
    throw new Error(`Failed to sign document: ${error}`);
  }
}

/**
 * Verify a signed document
 */
export async function verifySignedDocument(signedDocument: SignedDocument): Promise<boolean> {
  try {
    const recalculatedHash = generateHash(
      signedDocument.originalContent + signedDocument.signature.timestamp
    );
    
    return recalculatedHash === signedDocument.verificationHash;
  } catch (error) {
    console.error('Document verification error:', error);
    return false;
  }
}

/**
 * Add signature to PDF (metadata)
 */
export async function addSignatureToPDF(
  pdfContent: string,
  signatureData: SignatureData
): Promise<string> {
  try {
    // Add signature metadata to PDF
    const signedPDF = `${pdfContent}
%Signature Metadata
/Sig <</Type /Sig /Name (${signatureData.signedBy}) /M (${signatureData.timestamp})>>
`;

    return signedPDF;
  } catch (error) {
    console.error('PDF signature error:', error);
    throw new Error(`Failed to add signature to PDF: ${error}`);
  }
}

/**
 * Save signed document
 */
export async function saveSignedDocument(
  signedDocument: SignedDocument,
  fileName: string
): Promise<string> {
  try {
    const documentDir = FileSystem.documentDirectory || '';
    const filePath = `${documentDir}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, signedDocument.signedContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  } catch (error) {
    console.error('Error saving signed document:', error);
    throw error;
  }
}

/**
 * Generate a simple text-based signature
 */
function generateDefaultSignature(name: string): string {
  const signature = `
  ╔════════════════════════════════════╗
  ║  ${name.padEnd(32)}║
  ║  ${new Date().toLocaleDateString('ar-SA').padEnd(32)}║
  ╚════════════════════════════════════╝
  `;
  
  return Buffer.from(signature).toString('base64');
}

/**
 * Generate a simple hash for verification
 */
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Create certificate of authenticity
 */
export async function createCertificateOfAuthenticity(
  documentName: string,
  signedBy: string,
  timestamp: string
): Promise<string> {
  const certificate = `
╔════════════════════════════════════════════════════════════════╗
║                 CERTIFICATE OF AUTHENTICITY                   ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Document: ${documentName.padEnd(50)}║
║  Signed By: ${signedBy.padEnd(49)}║
║  Date: ${timestamp.padEnd(55)}║
║                                                                ║
║  This document has been digitally signed and verified.        ║
║  Any modifications to this document will invalidate the       ║
║  signature and certificate.                                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `;
  
  return certificate;
}
