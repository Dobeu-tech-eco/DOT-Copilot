import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { logError } from './logger';

class StorageService {
  private client: S3Client | null = null;
  private bucket: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;

    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET) {
      this.client = new S3Client({
        region: AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      });
      this.bucket = AWS_S3_BUCKET;
      this.isConfigured = true;
      console.log('Storage service configured with S3');
    } else {
      console.warn('Storage service not configured - file uploads will fail');
    }
  }

  async uploadFile(
    file: Buffer,
    originalName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<{ url: string; key: string } | null> {
    if (!this.isConfigured || !this.client || !this.bucket) {
      logError('Storage service not configured');
      return null;
    }

    const ext = path.extname(originalName);
    const key = `${folder}/${uuidv4()}${ext}`;

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }));

      const url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      
      return { url, key };
    } catch (error) {
      logError('Failed to upload file', error);
      return null;
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.isConfigured || !this.client || !this.bucket) {
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logError('Failed to get signed URL', error);
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    if (!this.isConfigured || !this.client || !this.bucket) {
      return false;
    }

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error) {
      logError('Failed to delete file', error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const storageService = new StorageService();
export default storageService;

