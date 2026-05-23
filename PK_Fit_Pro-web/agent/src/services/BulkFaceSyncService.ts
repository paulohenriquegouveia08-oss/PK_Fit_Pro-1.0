import { SupabaseClient } from '@supabase/supabase-js';
import { ControlIdAdapter } from '../adapters/ControlIdAdapter.js';
import { FaceSyncService } from './FaceSyncService.js';
import { addToQueue } from '../queues/faceSyncQueue.js';
import { logger, createChildLogger } from '../config/logger.js';
import type { ControlIdUser } from '../types/user.types.js';

export interface BulkSyncOptions {
    batchSize?: number;
    concurrency?: number;
    dryRun?: boolean;
}

export class BulkFaceSyncService {
    private readonly logger = createChildLogger({ service: 'BulkFaceSync' });

    constructor(
        private readonly supabase: SupabaseClient,
        private readonly faceSyncService: FaceSyncService,
        private readonly controlIdAdapter: ControlIdAdapter
    ) {}

    async syncAllUsers(
        academyId: string,
        options: BulkSyncOptions = {}
    ): Promise<{ success: number; failed: number; total: number }> {
        const { batchSize = 50, dryRun = false } = options;

        this.logger.info({ academyId, batchSize, dryRun }, 'Starting bulk face sync');

        const { data: users, error } = await this.supabase
            .from('users')
            .select('id, name, photo_url')
            .eq('role', 'ALUNO')
            .not('photo_url', 'is', null);

        if (error) {
            this.logger.error({ error }, 'Failed to fetch users');
            throw error;
        }

        if (!users || users.length === 0) {
            this.logger.info('No users with photos found');
            return { success: 0, failed: 0, total: 0 };
        }

        const usersWithPhotos = users.filter(u => u.photo_url);
        
        this.logger.info(
            { total: users.length, withPhotos: usersWithPhotos.length },
            'Users fetched'
        );

        if (dryRun) {
            this.logger.info({ users: usersWithPhotos.map(u => u.id) }, 'Dry run - would sync these users');
            return {
                success: usersWithPhotos.length,
                failed: 0,
                total: usersWithPhotos.length
            };
        }

        let success = 0;
        let failed = 0;

        const deviceOnline = await this.controlIdAdapter.healthCheck();
        if (!deviceOnline) {
            throw new Error('Device offline - cannot proceed with bulk sync');
        }

        for (const user of usersWithPhotos) {
            const controlIdUser: ControlIdUser = {
                id: parseInt(user.id.replace(/-/g, '').substring(0, 10), 10),
                name: user.name,
                photo_url: user.photo_url!
            };

            try {
                await addToQueue(
                    () => this.faceSyncService.sync(controlIdUser),
                    { id: `bulk-sync-${user.id}` }
                );
                success++;
            } catch (error) {
                this.logger.error({ userId: user.id, error }, 'Failed to queue user');
                failed++;
            }
        }

        this.logger.info({ success, failed, total: usersWithPhotos.length }, 'Bulk sync completed');

        return { success, failed, total: usersWithPhotos.length };
    }

    async getSyncStatus(): Promise<{
        pending: number;
        processing: number;
        completed: number;
    }> {
        const stats = this.faceSyncService.getStatus;
        
        return {
            pending: 0,
            processing: 0,
            completed: 0
        };
    }
}