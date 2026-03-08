package com.pkfit.agent.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pkfit.agent.adapters.CredentialEvent;
import com.pkfit.agent.adapters.TurnstileAdapter;
import com.pkfit.agent.supabase.SupabaseClient;

public class AccessController {

    private final TurnstileAdapter adapter;
    private final ConfigParser config;
    private final SupabaseClient supabase;
    private final ObjectMapper mapper;
    
    // Callback para interagir (atualizar logs na interface gráfica)
    private java.util.function.BiConsumer<Boolean, String> uiLogCallback;

    public AccessController(TurnstileAdapter adapter, ConfigParser config) {
        this.adapter = adapter;
        this.config = config;
        this.supabase = new SupabaseClient(config.getSupabaseUrl(), config.getSupabaseServiceKey());
        this.mapper = new ObjectMapper();
    }

    public void setUiLogCallback(java.util.function.BiConsumer<Boolean, String> callback) {
        this.uiLogCallback = callback;
    }

    public void start() {
        AppLogger.info("AccessController iniciado — aguardando leituras...");

        adapter.onCredentialRead((event) -> {
            new Thread(() -> handleCredentialEvent(event)).start();
        });
    }

    private void handleCredentialEvent(CredentialEvent event) {
        long startTime = System.currentTimeMillis();
        
        try {
            AppLogger.debug("Credencial recebida: " + event.getType() + " - " + event.getRawValue());

            String userId = resolveUserId(event);

            if (userId == null) {
                adapter.denyAccess();
                logToUi(false, "Desconhecido (Cartão/Bio não encontrada)");
                logAccessAsync(null, event, false, "NAO_ENCONTRADO", "Desconhecido");
                return;
            }

            ValidationResult result = validateAccess(userId);
            long elapsed = System.currentTimeMillis() - startTime;
            String userName = (result.userName != null) ? result.userName : "Aluno";

            if (result.granted) {
                adapter.grantAccess(TurnstileAdapter.Direction.IN);
                logToUi(true, userName + " (" + result.planName + ") - " + elapsed + "ms");
            } else {
                adapter.denyAccess();
                logToUi(false, userName + " (" + result.message + ") - " + elapsed + "ms");
            }

            logAccessAsync(userId, event, result.granted, result.granted ? null : result.reason, userName);

        } catch (Exception e) {
            AppLogger.error("Erro processando acesso", e);
            try { adapter.denyAccess(); } catch (Exception ignored) {}
            logToUi(false, "Erro no sistema ao validar: " + e.getMessage());
        }
    }

    private void logToUi(boolean granted, String message) {
        if (uiLogCallback != null) {
            // Executando callback no UI thread indiretamente (espera do caller)
            uiLogCallback.accept(granted, message);
        }
    }

    private String resolveUserId(CredentialEvent event) throws Exception {
        // Busca do UUID real através do RawValue lido (simplificado)
        ObjectNode params = mapper.createObjectNode();
        params.put("p_credential_value", event.getRawValue());
        JsonNode usersResponse = supabase.rpc("find_user_by_credential", params);
        
        // Se a function find_user_by_credential nao existir faremos fallbak pra Users View
        if (usersResponse != null && usersResponse.has("id")) {
             return usersResponse.get("id").asText();
        }
        
        // Supondo que em alguns casos o rawValue JA SEJA o user_id numérico ou fallback de teste
        return event.getRawValue(); 
    }

    private ValidationResult validateAccess(String userId) throws Exception {
        ObjectNode params = mapper.createObjectNode();
        params.put("p_academy_id", config.getAcademyId());
        params.put("p_user_id", userId);

        JsonNode result = supabase.rpc("validate_student_access", params);

        ValidationResult r = new ValidationResult();
        r.granted = result.has("granted") && result.get("granted").asBoolean();
        r.reason = result.has("reason") ? result.get("reason").asText() : "";
        r.message = result.has("message") ? result.get("message").asText() : "";
        r.userName = result.has("user_name") ? result.get("user_name").asText() : null;
        r.planName = result.has("plan_name") ? result.get("plan_name").asText() : null;

        return r;
    }

    private void logAccessAsync(String userId, CredentialEvent event, boolean granted, String reason, String userName) {
        new Thread(() -> {
            try {
                ObjectNode row = mapper.createObjectNode();
                row.put("academy_id", config.getAcademyId());
                if (userId != null) row.put("user_id", userId);
                row.put("turnstile_config_id", config.getTurnstileConfigId());
                row.put("direction", "IN");
                row.put("access_granted", granted);
                if (reason != null) row.put("denial_reason", reason);
                row.put("identification_method", event.getType().name());
                row.put("raw_credential", event.getRawValue());
                if (userName != null) row.put("user_name", userName);

                supabase.insert("access_logs", row);
            } catch (Exception e) {
                AppLogger.error("Failed to log access asynchronously", e);
            }
        }).start();
    }

    private static class ValidationResult {
        boolean granted;
        String reason;
        String message;
        String userName;
        String planName;
    }
}
