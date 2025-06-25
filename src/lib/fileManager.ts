import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import prisma from './db';

export interface FileUploadOptions {
  category: 'delivery-photos' | 'documents' | 'pdfs' | 'safety-checks';
  subCategory?: string;
  generateThumbnails?: boolean;
  compress?: boolean;
  quality?: number;
  metadata?: Record<string, any>;
}

export interface FileRecord {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: string;
  checksum: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ThumbnailRecord {
  id: string;
  fileId: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  filePath: string;
  width: number;
  height: number;
}

export class FileManager {
  private baseUploadPath = path.join(process.cwd(), 'uploads');
  
  constructor() {
    this.ensureDirectoryStructure();
  }

  /**
   * Upload and organize a file
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    options: FileUploadOptions
  ): Promise<FileRecord> {
    // Generate file checksum for duplicate detection
    const checksum = this.generateChecksum(fileBuffer);
    
    // Check for duplicates
    const existingFile = await this.findDuplicate(checksum);
    if (existingFile) {
      return existingFile;
    }

    // Generate organized file path
    const storedName = this.generateStoredName(originalName, mimeType);
    const filePath = this.generateFilePath(options.category, options.subCategory, storedName);
    const fullPath = path.join(this.baseUploadPath, filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Process file based on type
    let processedBuffer = fileBuffer;
    if (options.compress && this.isImage(mimeType)) {
      processedBuffer = await this.compressImage(fileBuffer, options.quality || 80);
    }

    // Save file
    await fs.writeFile(fullPath, processedBuffer);

    // Get category ID from category name
    const fileCategory = await prisma.fileCategory.findUnique({
      where: { name: options.category },
    });

    // Create file record
    const fileRecord = await prisma.file.create({
      data: {
        originalName,
        storedName,
        filePath,
        fileSize: processedBuffer.length,
        mimeType,
        categoryId: fileCategory?.id,
        uploadedBy,
        checksum,
        metadata: options.metadata || {},
      },
    });

    // Generate thumbnails if requested
    if (options.generateThumbnails && this.isImage(mimeType)) {
      await this.generateThumbnails(fileRecord.id, fullPath);
    }

    return fileRecord;
  }

  /**
   * Generate thumbnails for an image
   */
  async generateThumbnails(fileId: string, imagePath: string): Promise<ThumbnailRecord[]> {
    const thumbnailSizes = [
      { name: 'SMALL', width: 150, height: 150 },
      { name: 'MEDIUM', width: 300, height: 300 },
      { name: 'LARGE', width: 600, height: 600 },
    ];

    const thumbnails: ThumbnailRecord[] = [];

    for (const size of thumbnailSizes) {
      const thumbnailName = `thumb_${size.name}_${path.basename(imagePath)}`;
      const thumbnailPath = path.join('images', 'thumbnails', thumbnailName);
      const fullThumbnailPath = path.join(this.baseUploadPath, thumbnailPath);

      // Ensure thumbnail directory exists
      await fs.mkdir(path.dirname(fullThumbnailPath), { recursive: true });

      // Generate thumbnail
      const { width, height } = await sharp(imagePath)
        .resize(size.width, size.height, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(fullThumbnailPath);

      // Save thumbnail record
      const thumbnail = await prisma.fileThumbnail.create({
        data: {
          fileId,
          size: size.name as 'SMALL' | 'MEDIUM' | 'LARGE',
          filePath: thumbnailPath,
          width,
          height,
        },
      });

      thumbnails.push(thumbnail);
    }

    return thumbnails;
  }

  /**
   * Compress an image
   */
  async compressImage(buffer: Buffer, quality: number = 80): Promise<Buffer> {
    return await sharp(buffer)
      .jpeg({ quality, progressive: true })
      .toBuffer();
  }

  /**
   * Archive old files
   */
  async archiveOldFiles(category: string, olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldFiles = await prisma.file.findMany({
      where: {
        category,
        createdAt: { lt: cutoffDate },
        isArchived: false,
      },
    });

    let archivedCount = 0;

    for (const file of oldFiles) {
      try {
        // Move file to archive directory
        const currentPath = path.join(this.baseUploadPath, file.filePath);
        const archivePath = path.join(this.baseUploadPath, 'archive', file.filePath);
        
        await fs.mkdir(path.dirname(archivePath), { recursive: true });
        await fs.rename(currentPath, archivePath);

        // Update database record
        await prisma.file.update({
          where: { id: file.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            filePath: path.join('archive', file.filePath),
          },
        });

        archivedCount++;
      } catch (error) {
        console.error(`Failed to archive file ${file.id}:`, error);
      }
    }

    return archivedCount;
  }

  /**
   * Cleanup temporary files
   */
  async cleanupTempFiles(): Promise<number> {
    const tempDir = path.join(this.baseUploadPath, 'temp');
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    try {
      const files = await fs.readdir(tempDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
      return 0;
    }
  }

  /**
   * Get secure file URL with expiration
   */
  async getSecureFileUrl(fileId: string, expiresInMinutes: number = 60): Promise<string> {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error('File not found');

    const token = this.generateSecureToken(fileId, expiresInMinutes);
    return `/api/files/secure/${fileId}?token=${token}`;
  }

  // Private helper methods
  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async findDuplicate(checksum: string): Promise<FileRecord | null> {
    return await prisma.file.findFirst({
      where: { checksum, isArchived: false },
    });
  }

  private generateStoredName(originalName: string, mimeType: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = this.getExtensionFromMimeType(mimeType);
    return `${timestamp}_${random}${extension}`;
  }

  private generateFilePath(category: string, subCategory: string | undefined, fileName: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Map categories to directory paths
    const categoryPaths: Record<string, string> = {
      'delivery-photos': 'images/delivery-photos',
      'safety-checks': 'images/safety-checks',
      'documents': 'documents/other',
      'invoices': 'documents/invoices',
      'credit-memos': 'documents/credit-memos',
      'statements': 'documents/statements',
      'pdfs': 'pdfs/delivery-receipts',
      'reports': 'pdfs/reports',
    };

    const basePath = categoryPaths[category] || 'documents/other';
    const parts = [basePath, year.toString(), month];

    if (subCategory) parts.push(subCategory);
    parts.push(fileName);

    return path.join(...parts);
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return extensions[mimeType] || '';
  }

  private generateSecureToken(fileId: string, expiresInMinutes: number): string {
    const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
    const payload = `${fileId}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
      .update(payload)
      .digest('hex');

    // Return base64 encoded payload + signature for easy parsing
    const tokenData = {
      fileId,
      expiresAt,
      signature
    };

    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  private async ensureDirectoryStructure(): Promise<void> {
    const directories = [
      'documents/invoices',
      'documents/credit-memos',
      'documents/statements',
      'documents/other',
      'images/delivery-photos',
      'images/safety-checks',
      'images/thumbnails',
      'pdfs/delivery-receipts',
      'pdfs/reports',
      'temp',
      'archive',
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(this.baseUploadPath, dir), { recursive: true });
    }
  }
}

export const fileManager = new FileManager();
