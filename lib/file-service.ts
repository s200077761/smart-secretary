import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface FileData {
  uri: string;
  name: string;
  type: string;
  size?: number;
  mimeType?: string;
}

export interface DocumentData extends FileData {
  base64?: string;
}

/**
 * File Service - Handles file uploads, camera capture, and document operations
 */

// Pick image from camera
export async function pickImageFromCamera(): Promise<FileData | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission denied');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: `photo_${Date.now()}.jpg`,
      type: 'image/jpeg',
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Error picking image from camera:', error);
    throw error;
  }
}

// Pick image from library
export async function pickImageFromLibrary(): Promise<FileData | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission denied');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: `image_${Date.now()}.jpg`,
      type: 'image/jpeg',
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Error picking image from library:', error);
    throw error;
  }
}

// Pick document
export async function pickDocument(): Promise<DocumentData | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/html'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    const fileInfo = await FileSystem.getInfoAsync(asset.uri);

    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
      mimeType: asset.mimeType,
      size: fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : undefined,
    };
  } catch (error) {
    console.error('Error picking document:', error);
    throw error;
  }
}

// Convert file to base64
export async function fileToBase64(fileUri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw error;
  }
}

// Save file to app cache
export async function saveFileToCache(fileUri: string, fileName: string): Promise<string> {
  try {
    const cacheDir = FileSystem.cacheDirectory || '';
    const newPath = `${cacheDir}${fileName}`;
    
    await FileSystem.copyAsync({
      from: fileUri,
      to: newPath,
    });

    return newPath;
  } catch (error) {
    console.error('Error saving file to cache:', error);
    throw error;
  }
}

// Get file size
export async function getFileSize(fileUri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists && 'size' in fileInfo) {
      return (fileInfo as any).size || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

// Download file
export async function downloadFile(url: string, fileName: string): Promise<string> {
  try {
    const downloadDir = FileSystem.documentDirectory || '';
    const filePath = `${downloadDir}${fileName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      filePath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesExpectedToDownload
          ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToDownload
          : 0;
        console.log(`Download progress: ${Math.round(progress * 100)}%`);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result) throw new Error('Download failed');

    return result.uri;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Delete file
export async function deleteFile(fileUri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// List files in directory
export async function listFilesInDirectory(dirPath: string): Promise<string[]> {
  try {
    const files = await FileSystem.readDirectoryAsync(dirPath);
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

// Get MIME type from file extension
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    html: 'text/html',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
