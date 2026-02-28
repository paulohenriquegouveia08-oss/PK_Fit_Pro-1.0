export interface LocalConfig {
    supabaseUrl: string;
    supabaseServiceKey: string;
    academyId: string;
    academyName: string;
    turnstileConfigId: string;
    turnstileName: string;
    brand: string;
    model: string;
    ipAddress: string;
    port: number;
    authUser: string;
    authPassword: string;
    pairedAt: string;
}
/**
 * Verifica se já existe configuração local salva
 */
export declare function hasLocalConfig(): boolean;
/**
 * Carrega configuração local salva
 */
export declare function loadLocalConfig(): LocalConfig | null;
/**
 * Executa o setup wizard interativo
 * Pede URL do Supabase, Service Key e código de pareamento
 */
export declare function runSetupWizard(): Promise<LocalConfig>;
//# sourceMappingURL=setup.d.ts.map