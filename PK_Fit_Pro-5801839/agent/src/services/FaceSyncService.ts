import { ControlIdAdapter } from '../adapters/ControlIdAdapter';
import { downloadImage, downloadImageWithSignedUrl } from '../utils/downloadImage';
import { processFaceImage, validateFaceImage } from '../processors/imageProcessor';
import { logger, createChildLogger } from '../config/logger';
import { ControlIdUser, FaceSyncResult, FaceSyncStatus } from '../types/user.types';
import { AdapterError } from '../adapters/IBaseAdapter';

export interface FaceSyncServiceConfig {
    supabaseUrl?: string;
    supabaseKey?: string;
    bucket?: string;
}

export class FaceSyncService {
    private readonly logger = createChildLogger({ service: 'FaceSync' });
    private syncStatuses: Map<string, FaceSyncStatus> = new Map();

    constructor(
        private readonly adapter: ControlIdAdapter,
        private readonly config?: FaceSyncServiceConfig
    ) {}

    getStatus(userId: string): FaceSyncStatus | undefined {
        return this.syncStatuses.get(userId);
    }

    async sync(user: ControlIdUser): Promise<FaceSyncResult> {
        const userId = String(user.id);
        
        this.updateStatus(userId, 'PROCESSING');
        
        this.logger.info({ userId, name: user.name }, 'Starting face sync');

        try {
            if (!user.photo_url) {
                throw new Error('Usuário sem foto');
            }

            let imageBuffer: Buffer;

            if (this.config?.supabaseUrl && this.config?.supabaseKey) {
                const isSupabaseUrl = user.photo_url.includes('supabase') || 
                                     user.photo_url.includes('storage');
                
                if (isSupabaseUrl) {
                    const path = this.extractPathFromUrl(user.photo_url);
                    if (path) {
                        imageBuffer = await downloadImageWithSignedUrl(
                            this.config.supabaseUrl,
                            this.config.supabaseKey,
                            this.config.bucket || 'avatars',
                            path
                        );
                    } else {
                        imageBuffer = await downloadImage(user.photo_url);
                    }
                } else {
                    imageBuffer = await downloadImage(user.photo_url);
                }
            } else {
                imageBuffer = await downloadImage(user.photo_url);
            }

            this.logger.debug({ userId, imageSize: imageBuffer.length }, 'Image downloaded');

            const isValidFormat = await validateFaceImage(imageBuffer);
            if (!isValidFormat) {
                throw new AdapterError(
                    'Formato de imagem inválido ou imagem muito pequena',
                    'INVALID_IMAGE_FORMAT',
                    undefined,
                    false
                );
            }

            const processedImage = await processFaceImage(imageBuffer);
            this.logger.debug({ userId, processedSize: processedImage.length }, 'Image processed');

            const deviceOnline = await this.adapter.healthCheck();
            if (!deviceOnline) {
                throw new AdapterError(
                    'Catraca offline ou inacessível',
                    'DEVICE_OFFLINE',
                    undefined,
                    true
                );
            }

            const userIdNumber = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
            
            await this.adapter.createUser(user);

            const isFaceValid = await this.adapter.validateFaceImage(processedImage);
            if (!isFaceValid) {
                throw new AdapterError(
                    'Imagem facial inválida - rosto não detectado ou qualidade insuficiente',
                    'INVALID_FACE_IMAGE',
                    undefined,
                    false
                );
            }

            await this.adapter.registerFace(userIdNumber, processedImage);

            this.updateStatus(userId, 'SUCCESS');
            
            this.logger.info({ userId, name: user.name }, 'Face synced successfully');

            return {
                success: true,
                userId,
                message: 'Face sincronizada com sucesso'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            const isRetryable = error instanceof AdapterError ? error.isRetryable : false;
            
            const currentStatus = this.syncStatuses.get(userId);
            const attempts = currentStatus?.attempts || 0;

            if (isRetryable && attempts < 3) {
                this.updateStatus(userId, 'RETRYING', errorMessage);
            } else {
                this.updateStatus(userId, 'FAILED', errorMessage);
            }

            this.logger.error({
                userId,
                error: errorMessage,
                isRetryable,
                attempts
            }, 'Face sync failed');

            return {
                success: false,
                userId,
                message: errorMessage,
                errorCode: error instanceof AdapterError ? error.code : 'UNKNOWN_ERROR'
            };
        }
    }

    async syncBatch(users: ControlIdUser[]): Promise<FaceSyncResult[]> {
        this.logger.info({ count: users.length }, 'Starting batch face sync');

        const results = await Promise.allSettled(
            users.map(user => this.sync(user))
        );

        const syncResults: FaceSyncResult[] = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                const userId = String(users[index].id);
                return {
                    success: false,
                    userId,
                    message: result.reason?.message || 'Erro desconhecido',
                    errorCode: 'BATCH_ERROR'
                };
            }
        });

        const successCount = syncResults.filter(r => r.success).length;
        this.logger.info(
            { total: users.length, success: successCount, failed: users.length - successCount },
            'Batch sync completed'
        );

        return syncResults;
    }

    async removeFace(userId: number): Promise<void> {
        this.logger.info({ userId }, 'Removing face');

        await this.adapter.deleteFace(userId);
        
        this.syncStatuses.delete(String(userId));
    }

    private updateStatus(userId: string, status: FaceSyncStatus['status'], errorMessage?: string): void {
        const current = this.syncStatuses.get(userId);
        
        this.syncStatuses.set(userId, {
            userId,
            status,
            errorMessage,
            attempts: current ? current.attempts + (status === 'RETRYING' ? 1 : 0) : 1,
            lastAttempt: new Date(),
            createdAt: current?.createdAt || new Date()
        });
    }

    private extractPathFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public\/)?(?:sign\/)?(?:avatars\/)?(.+)$/);
            if (pathMatch) {
                return pathMatch[1];
            }
            
            const pathParts = urlObj.pathname.split('/');
            const avatarsIndex = pathParts.indexOf('avatars');
            if (avatarsIndex !== -1) {
                return pathParts.slice(avatarsIndex + 1).join('/');
            }
            
            return null;
        } catch {
            return null;
        }
    }
}