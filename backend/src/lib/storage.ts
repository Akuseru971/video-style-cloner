import { Storage } from '@google-cloud/storage';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const storage = new Storage({
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE_PATH,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'video-style-cloner-bucket';
const bucket = storage.bucket(bucketName);

export async function downloadVideoFromUrl(
  videoUrl: string
): Promise<string> {
  try {
    console.log('[Storage] Downloading video from:', videoUrl);

    // Télécharger la vidéo depuis l'URL
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const buffer = await response.buffer();

    // Générer un nom de fichier unique
    const filename = `source-videos/${uuidv4()}.mp4`;
    const file = bucket.file(filename);

    // Uploader vers GCS
    await file.save(buffer, {
      metadata: {
        contentType: 'video/mp4',
      },
    });

    console.log('[Storage] Video uploaded to GCS:', filename);

    // Retourner l'URI GCS
    return `gs://${bucketName}/${filename}`;
  } catch (error) {
    console.error('[Storage] Error:', error);
    throw error;
  }
}

export async function uploadVideoToStorage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  try {
    console.log('[Storage] Uploading video:', filename);

    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: {
        contentType: 'video/mp4',
      },
    });

    console.log('[Storage] Video uploaded:', filename);

    // Retourner l'URL publique
    return `https://storage.googleapis.com/${bucketName}/${filename}`;
  } catch (error) {
    console.error('[Storage] Error:', error);
    throw error;
  }
}

export async function getPublicUrl(filename: string): Promise<string> {
  return `https://storage.googleapis.com/${bucketName}/${filename}`;
}

export default {
  downloadVideoFromUrl,
  uploadVideoToStorage,
  getPublicUrl,
};