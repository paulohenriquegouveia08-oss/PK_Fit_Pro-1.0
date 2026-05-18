import axios, { AxiosInstance, AxiosError } from 'axios';
import { IBaseAdapter, AdapterError, DeviceInfo } from './IBaseAdapter';
import { ControlIdUser } from '../types/user.types';
import { logger, createChildLogger } from '../config/logger';
import { retry } from '../utils/retry';

export interface ControlIdConfig {
    baseUrl: string;
    username: string;
    password: string;
    timeout?: number;
    maxRetries?: number;
}

interface ControlIdResponse {
    success?: boolean;
    session?: string;
    [key: string]: unknown;
}

export class ControlIdAdapter implements IBaseAdapter {
    private client: AxiosInstance;
    private session: string | null = null;
    private sessionExpiresAt: number | null = null;
    private readonly logger = createChildLogger({ adapter: 'ControlId' });
    private readonly maxRetries: number;
    private readonly timeout: number;

    constructor(config: ControlIdConfig) {
        this.maxRetries = config.maxRetries ?? 3;
        this.timeout = config.timeout ?? 10000;

        this.client = axios.create({
            baseURL: config.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.client.interceptors.response.use(
            response => response,
            (error: AxiosError) => {
                this.logger.error({
                    url: error.config?.url,
                    status: error.response?.status,
                    message: error.message
                }, 'HTTP Error');

                return Promise.reject(error);
            }
        );

        this.logger.info({ baseUrl: config.baseUrl }, 'Control ID Adapter initialized');
    }

    private isSessionValid(): boolean {
        return !!(
            this.session &&
            this.sessionExpiresAt &&
            Date.now() < this.sessionExpiresAt
        );
    }

    async connect(): Promise<void> {
        if (this.isSessionValid()) {
            this.logger.debug('Using cached session');
            return;
        }

        this.logger.info('Authenticating with Control ID device');

        try {
            const response = await retry(
                () => this.client.post<ControlIdResponse>('/login.fcgi', {
                    login: this.client.defaults.baseURL?.split('://')[1]?.split(':')[0] || '',
                    password: ''
                }).catch(() => {
                    return this.client.post<ControlIdResponse>('/login.fcgi', {
                        login: 'admin',
                        password: 'admin'
                    });
                }),
                { retries: this.maxRetries, delay: 1000 }
            );

            if (!response.data?.session) {
                const errorResponse = response.data as Record<string, unknown>;
                throw new AdapterError(
                    `Authentication failed: ${JSON.stringify(errorResponse)}`,
                    'AUTH_FAILED',
                    undefined,
                    false
                );
            }

            this.session = response.data.session;
            this.sessionExpiresAt = Date.now() + 1000 * 60 * 25;

            this.logger.info({ expiresAt: new Date(this.sessionExpiresAt).toISOString() }, 'Session authenticated');
        } catch (error) {
            if (error instanceof AdapterError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new AdapterError(`Failed to connect: ${message}`, 'CONNECTION_FAILED', undefined, true);
        }
    }

    async disconnect(): Promise<void> {
        if (this.session) {
            try {
                await this.client.post('/logout.fcgi', {}, {
                    params: { session: this.session }
                });
            } catch (error) {
                this.logger.warn({ error }, 'Error during logout');
            }
        }

        this.session = null;
        this.sessionExpiresAt = null;
        this.logger.info('Disconnected from device');
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.get('/', { timeout: 5000 });
            const isOnline = response.status === 200;

            this.logger.debug({ online: isOnline }, 'Health check');
            return isOnline;
        } catch (error) {
            this.logger.warn({ error }, 'Health check failed - device offline');
            return false;
        }
    }

    async createUser(user: ControlIdUser): Promise<number> {
        await this.ensureAuthenticated();

        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;

        this.logger.info({ userId, name: user.name }, 'Creating user');

        const userExists = await this.userExists(userId);
        if (userExists) {
            this.logger.info({ userId }, 'User already exists');
            return userId;
        }

        const response = await retry(
            () => this.client.post<ControlIdResponse>(
                '/create_objects.fcgi',
                {
                    object: 'users',
                    values: [{
                        id: userId,
                        name: user.name,
                        registration: user.registration || String(userId),
                        password: ''
                    }]
                },
                { params: { session: this.session } }
            ),
            { retries: this.maxRetries, delay: 1000 }
        );

        if (!response.data?.success) {
            this.logger.error({ response: response.data }, 'Failed to create user');
            throw new AdapterError(
                `Failed to create user: ${JSON.stringify(response.data)}`,
                'USER_CREATE_FAILED',
                undefined,
                false
            );
        }

        this.logger.info({ userId }, 'User created successfully');
        return userId;
    }

    async getUser(userId: number): Promise<ControlIdUser | null> {
        await this.ensureAuthenticated();

        try {
            const response = await this.client.get('/get_objects.fcgi', {
                params: {
                    session: this.session,
                    object: 'users',
                    id: userId
                }
            });

            const users = response.data?.users as Array<{ id: number; name: string }> | undefined;
            if (!users || users.length === 0) {
                return null;
            }

            return {
                id: users[0].id,
                name: users[0].name
            };
        } catch (error) {
            this.logger.warn({ userId, error }, 'Failed to get user');
            return null;
        }
    }

    async userExists(userId: number): Promise<boolean> {
        const user = await this.getUser(userId);
        return user !== null;
    }

    async registerFace(userId: number, imageBuffer: Buffer): Promise<void> {
        await this.ensureAuthenticated();

        this.logger.info({ userId, imageSize: imageBuffer.length }, 'Registering face');

        const faceExists = await this.userHasFace(userId);
        if (faceExists) {
            this.logger.info({ userId }, 'Face already registered, updating');
            await this.deleteFace(userId);
        }

        const timestamp = Math.floor(Date.now() / 1000);

        const response = await retry(
            () => this.client.post<ControlIdResponse>(
                '/user_set_image.fcgi',
                imageBuffer,
                {
                    params: {
                        session: this.session,
                        user_id: userId,
                        timestamp,
                        match: 1
                    },
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    }
                }
            ),
            { retries: this.maxRetries, delay: 1000 }
        );

        if (!response.data?.success) {
            this.logger.error({ response: response.data }, 'Failed to register face');
            throw new AdapterError(
                `Failed to register face: ${JSON.stringify(response.data)}`,
                'FACE_REGISTER_FAILED',
                undefined,
                false
            );
        }

        this.logger.info({ userId }, 'Face registered successfully');
    }

    private async userHasFace(userId: number): Promise<boolean> {
        try {
            const response = await this.client.get('/user_get_image.fcgi', {
                params: {
                    session: this.session,
                    user_id: userId
                }
            });
            return response.data?.image === true || response.data?.exists === true;
        } catch {
            return false;
        }
    }

    async validateFaceImage(imageBuffer: Buffer): Promise<boolean> {
        await this.ensureAuthenticated();

        this.logger.debug({ imageSize: imageBuffer.length }, 'Validating face image');

        try {
            const response = await retry(
                () => this.client.post<ControlIdResponse>(
                    '/user_test_image.fcgi',
                    imageBuffer,
                    {
                        params: { session: this.session },
                        headers: { 'Content-Type': 'application/octet-stream' }
                    }
                ),
                { retries: this.maxRetries, delay: 500 }
            );

            const isValid = response.data?.success === true ||
                           response.data?.valid === true ||
                           response.data?.match === true;

            this.logger.debug({ valid: isValid, response: response.data }, 'Face validation result');
            return isValid;
        } catch (error) {
            this.logger.warn({ error }, 'Face validation failed');
            return false;
        }
    }

    async deleteFace(userId: number): Promise<void> {
        await this.ensureAuthenticated();

        this.logger.info({ userId }, 'Deleting face');

        try {
            await retry(
                () => this.client.post<ControlIdResponse>(
                    '/user_destroy_image.fcgi',
                    {},
                    {
                        params: {
                            session: this.session,
                            user_id: userId
                        }
                    }
                ),
                { retries: this.maxRetries, delay: 500 }
            );

            this.logger.info({ userId }, 'Face deleted');
        } catch (error) {
            this.logger.warn({ userId, error }, 'Failed to delete face (may not exist)');
        }
    }

    async deleteUser(userId: number): Promise<void> {
        await this.ensureAuthenticated();

        this.logger.info({ userId }, 'Deleting user');

        const response = await retry(
            () => this.client.post<ControlIdResponse>(
                '/destroy_objects.fcgi',
                {
                    object: 'users',
                    ids: [userId]
                },
                { params: { session: this.session } }
            ),
            { retries: this.maxRetries, delay: 1000 }
        );

        if (!response.data?.success) {
            throw new AdapterError(
                `Failed to delete user: ${JSON.stringify(response.data)}`,
                'USER_DELETE_FAILED',
                undefined,
                false
            );
        }

        this.logger.info({ userId }, 'User deleted');
    }

    async openDoor(): Promise<void> {
        await this.ensureAuthenticated();

        this.logger.info('Opening door');

        const response = await retry(
            () => this.client.post<ControlIdResponse>(
                '/execute_actions.fcgi',
                {
                    actions: [{ action: 'door' }]
                },
                { params: { session: this.session } }
            ),
            { retries: this.maxRetries, delay: 500 }
        );

        if (!response.data?.success) {
            throw new AdapterError(
                `Failed to open door: ${JSON.stringify(response.data)}`,
                'DOOR_OPEN_FAILED',
                undefined,
                false
            );
        }

        this.logger.info('Door opened');
    }

    async getDeviceInfo(): Promise<DeviceInfo> {
        await this.ensureAuthenticated();

        const response = await this.client.get('/get_devices_info.fcgi', {
            params: { session: this.session }
        });

        const deviceData = response.data?.devices?.[0] || response.data;

        return {
            model: deviceData?.model || 'Unknown',
            firmware: deviceData?.firmware || 'Unknown',
            serialNumber: deviceData?.serial || 'Unknown',
            ip: this.client.defaults.baseURL?.replace(/^https?:\/\//, '') || 'Unknown',
            mac: deviceData?.mac
        };
    }

    private async ensureAuthenticated(): Promise<void> {
        if (!this.isSessionValid()) {
            await this.connect();
        }
    }
}