import { ControlIdUser } from '../types/user.types';

export interface IBaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<boolean>;
    createUser(user: ControlIdUser): Promise<number>;
    getUser(userId: number): Promise<ControlIdUser | null>;
    userExists(userId: number): Promise<boolean>;
    registerFace(userId: number, imageBuffer: Buffer): Promise<void>;
    validateFaceImage(imageBuffer: Buffer): Promise<boolean>;
    deleteFace(userId: number): Promise<void>;
    deleteUser(userId: number): Promise<void>;
    openDoor(): Promise<void>;
    getDeviceInfo(): Promise<DeviceInfo>;
}

export interface DeviceInfo {
    model: string;
    firmware: string;
    serialNumber: string;
    ip: string;
    mac?: string;
}

export interface AdapterConfig {
    baseUrl: string;
    username: string;
    password: string;
    timeout?: number;
    retries?: number;
}

export class AdapterError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode?: number,
        public readonly isRetryable: boolean = false
    ) {
        super(message);
        this.name = 'AdapterError';
    }
}

export interface FaceValidationResult {
    valid: boolean;
    faceDetected: boolean;
    confidence?: number;
    errorMessage?: string;
}

export interface UserRegistrationResult {
    success: boolean;
    userId?: number;
    faceRegistered: boolean;
    message: string;
}