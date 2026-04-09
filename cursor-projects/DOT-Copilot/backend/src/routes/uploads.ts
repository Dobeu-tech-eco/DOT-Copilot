import { logError } from '../services/logger';
import { Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import storageService from '../services/storage';
import azureStorageService from '../services/azureStorage';
import { sanitizeStorageKey } from '../utils/security';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

router.use(authenticate);

// Upload single file
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Use Azure Storage if configured, otherwise fall back to S3
    const useAzure = azureStorageService.isReady();
    const storage = useAzure ? azureStorageService : storageService;
    
    if (!storage.isReady()) {
      return res.status(503).json({ error: 'Storage service not configured' });
    }

    const ALLOWED_FOLDERS = ['uploads', 'training', 'documents', 'avatars', 'certificates'];
    const rawFolder = String(req.body.folder || 'uploads');
    const folder = ALLOWED_FOLDERS.includes(rawFolder) ? rawFolder : 'uploads';

    const ext = req.file.originalname.includes('.')
      ? '.' + req.file.originalname.split('.').pop()
      : '';
    const safeFilename = `${crypto.randomUUID()}${ext}`;

    const result = await storage.uploadFile(
      req.file.buffer,
      safeFilename,
      req.file.mimetype,
      folder
    );

    if (!result) {
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Handle different return types from S3 vs Azure
    const fileKey = useAzure ? (result as { url: string; blobName: string }).blobName : (result as { url: string; key: string }).key;

    res.status(201).json({
      data: {
        url: result.url,
        key: fileKey,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
      },
    });
  } catch (error: any) {
    logError('Upload error', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Get signed download URL
router.get('/download/:key(*)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawKey = req.params.key;
    const key = sanitizeStorageKey(rawKey);
    
    // Use Azure Storage if configured, otherwise fall back to S3
    const useAzure = azureStorageService.isReady();
    const storage = useAzure ? azureStorageService : storageService;
    
    if (!storage.isReady()) {
      return res.status(503).json({ error: 'Storage service not configured' });
    }

    let url: string | null = null;
    if (useAzure) {
      url = await (storage as typeof azureStorageService).getSignedDownloadUrl(key);
    } else {
      url = await (storage as typeof storageService).getSignedDownloadUrl(key);
    }
    
    if (!url) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ data: { url } });
  } catch (error: any) {
    logError('Download URL error', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// Delete file
router.delete('/:key(*)', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawKey = req.params.key;
    const key = sanitizeStorageKey(rawKey);
    
    // Use Azure Storage if configured, otherwise fall back to S3
    const storage = azureStorageService.isReady() ? azureStorageService : storageService;
    
    if (!storage.isReady()) {
      return res.status(503).json({ error: 'Storage service not configured' });
    }

    const success = await storage.deleteFile(key);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete file' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    logError('Delete error', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;

