import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system';

/**
 * Email Service - Send files and documents via email
 */

export interface EmailAttachment {
  uri: string;
  name: string;
  mimeType: string;
}

export interface EmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  isHTML?: boolean;
}

/**
 * Check if email is available
 */
export async function isEmailAvailable(): Promise<boolean> {
  try {
    const available = await MailComposer.isAvailableAsync();
    return available;
  } catch (error) {
    console.error('Email availability check error:', error);
    return false;
  }
}

/**
 * Send email with attachments
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const available = await isEmailAvailable();
    if (!available) {
      throw new Error('Email service is not available on this device');
    }

    const result = await MailComposer.composeAsync({
      recipients: options.to,
      ccRecipients: options.cc,
      bccRecipients: options.bcc,
      subject: options.subject,
      body: options.body,
      attachments: options.attachments?.map(att => att.uri),
      isHtml: options.isHTML || false,
    });

    return result.status === MailComposer.MailComposerStatus.SENT;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error}`);
  }
}

/**
 * Send document via email
 */
export async function sendDocument(
  documentPath: string,
  documentName: string,
  recipientEmail: string,
  subject: string = 'Document'
): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(documentPath);
    if (!fileInfo.exists) {
      throw new Error('Document file not found');
    }

    const mimeType = getMimeTypeFromFileName(documentName);

    const emailOptions: EmailOptions = {
      to: [recipientEmail],
      subject: subject,
      body: `Please find the attached document: ${documentName}`,
      attachments: [
        {
          uri: documentPath,
          name: documentName,
          mimeType: mimeType,
        },
      ],
    };

    return sendEmail(emailOptions);
  } catch (error) {
    console.error('Document sending error:', error);
    throw error;
  }
}

/**
 * Send multiple documents via email
 */
export async function sendMultipleDocuments(
  documents: { path: string; name: string }[],
  recipientEmail: string,
  subject: string = 'Documents'
): Promise<boolean> {
  try {
    const attachments: EmailAttachment[] = [];

    for (const doc of documents) {
      const fileInfo = await FileSystem.getInfoAsync(doc.path);
      if (fileInfo.exists) {
        attachments.push({
          uri: doc.path,
          name: doc.name,
          mimeType: getMimeTypeFromFileName(doc.name),
        });
      }
    }

    if (attachments.length === 0) {
      throw new Error('No valid documents found');
    }

    const emailOptions: EmailOptions = {
      to: [recipientEmail],
      subject: subject,
      body: `Please find the attached documents:\n\n${documents.map(d => `• ${d.name}`).join('\n')}`,
      attachments: attachments,
    };

    return sendEmail(emailOptions);
  } catch (error) {
    console.error('Multiple documents sending error:', error);
    throw error;
  }
}

/**
 * Create email draft with document
 */
export async function createEmailDraft(
  documentPath: string,
  documentName: string,
  recipientEmail: string,
  subject: string = 'Document'
): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(documentPath);
    if (!fileInfo.exists) {
      throw new Error('Document file not found');
    }

    const mimeType = getMimeTypeFromFileName(documentName);

    await MailComposer.composeAsync({
      recipients: [recipientEmail],
      subject: subject,
      body: `Please find the attached document: ${documentName}`,
      attachments: [documentPath],
    });
  } catch (error) {
    console.error('Email draft creation error:', error);
    throw error;
  }
}

/**
 * Send email with HTML body
 */
export async function sendHTMLEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  try {
    const emailOptions: EmailOptions = {
      to,
      subject,
      body: htmlBody,
      attachments,
      isHTML: true,
    };

    return sendEmail(emailOptions);
  } catch (error) {
    console.error('HTML email sending error:', error);
    throw error;
  }
}

/**
 * Get MIME type from file name
 */
function getMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    html: 'text/html',
    rtf: 'application/rtf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    zip: 'application/zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Create email template
 */
export function createEmailTemplate(
  recipientName: string,
  documentName: string,
  senderName: string
): string {
  return `
السلام عليكم ورحمة الله وبركاته

السيد/السيدة ${recipientName}

يرجى قبول هذا البريد الإلكتروني مع المرفق الذي يتضمن الوثيقة التالية:

📄 ${documentName}

تم إرسال هذا البريد من خلال تطبيق السكرتير الذكي.

مع أطيب التحيات
${senderName}

---
This email was sent from Smart Secretary Application
`;
}
