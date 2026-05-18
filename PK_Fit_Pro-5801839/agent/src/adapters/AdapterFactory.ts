import { IBaseAdapter, AdapterConfig } from './IBaseAdapter.js';
import { ControlIdAdapter } from './ControlIdAdapter.js';

export type AdapterType = 'controlid' | 'hikvision' | 'intelbras' | 'topdata' | 'henry';

export interface AdapterFactoryConfig extends AdapterConfig {
    type: AdapterType;
}

export class AdapterFactory {
    static createAdapter(config: AdapterFactoryConfig): IBaseAdapter {
        switch (config.type) {
            case 'controlid':
                return new ControlIdAdapter({
                    baseUrl: config.baseUrl,
                    username: config.username,
                    password: config.password,
                    timeout: config.timeout,
                    maxRetries: config.retries
                });

            case 'hikvision':
                throw new Error('Hikvision adapter not yet implemented');

            case 'intelbras':
                throw new Error('Intelbras adapter not yet implemented');

            case 'topdata':
                throw new Error('TopData adapter not yet implemented');

            case 'henry':
                throw new Error('Henry adapter not yet implemented');

            default:
                throw new Error(`Unknown adapter type: ${config.type}`);
        }
    }

    static getSupportedAdapters(): AdapterType[] {
        return ['controlid'];
    }

    static isSupported(type: string): boolean {
        return this.getSupportedAdapters().includes(type as AdapterType);
    }
}