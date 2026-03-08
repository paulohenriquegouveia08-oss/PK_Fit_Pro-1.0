package com.pkfit.agent.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pkfit.agent.supabase.SupabaseClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ConfigParser {

    private String supabaseUrl;
    private String supabaseServiceKey;
    private String academyId;
    private String academyName;
    private String turnstileConfigId;
    private String turnstileName;
    private String brand;
    private String ipAddress;
    private int port;
    private String authUser;
    private String authPassword;

    // Caminho do arquivo de config local (mesmo padrão do Node agent)
    private static final String CONFIG_FILE_NAME = "pk-fit-config.json";

    /**
     * Construtor privado — usar os métodos estáticos para criar
     */
    private ConfigParser() {
    }

    /**
     * Cria uma config a partir dos dados retornados pelo RPC de pareamento
     */
    public static ConfigParser fromPairingResult(String supabaseUrl, String supabaseServiceKey, JsonNode rpcResult)
            throws Exception {
        ConfigParser config = new ConfigParser();

        config.supabaseUrl = supabaseUrl;
        config.supabaseServiceKey = supabaseServiceKey;
        config.academyId = getField(rpcResult, "academy_id", "");
        config.academyName = getField(rpcResult, "academy_name", "Academia");
        config.turnstileConfigId = getField(rpcResult, "turnstile_config_id", "");
        config.turnstileName = getField(rpcResult, "turnstile_name", "Catraca");
        config.brand = getField(rpcResult, "brand", "CONTROL_ID");
        config.ipAddress = getField(rpcResult, "ip_address", "");
        config.port = rpcResult.has("port") ? rpcResult.get("port").asInt(80) : 80;
        config.authUser = getField(rpcResult, "auth_user", "");
        config.authPassword = getField(rpcResult, "auth_password", "");

        if (config.ipAddress.isEmpty()) {
            throw new Exception("Configuração inválida: IP da catraca não informado no pareamento.");
        }

        return config;
    }

    /**
     * Carrega config a partir do arquivo local salvo (pk-fit-config.json)
     */
    public static ConfigParser loadFromFile() throws Exception {
        Path filePath = getConfigFilePath();
        if (!Files.exists(filePath)) {
            return null;
        }

        String json = Files.readString(filePath);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(json);

        ConfigParser config = new ConfigParser();
        config.supabaseUrl = getField(root, "supabaseUrl", "");
        config.supabaseServiceKey = getField(root, "supabaseServiceKey", "");
        config.academyId = getField(root, "academyId", "");
        config.academyName = getField(root, "academyName", "Academia");
        config.turnstileConfigId = getField(root, "turnstileConfigId", "");
        config.turnstileName = getField(root, "turnstileName", "Catraca");
        config.brand = getField(root, "brand", "CONTROL_ID");
        config.ipAddress = getField(root, "ipAddress", "");
        config.port = root.has("port") ? root.get("port").asInt(80) : 80;
        config.authUser = getField(root, "authUser", "");
        config.authPassword = getField(root, "authPassword", "");

        if (config.supabaseUrl.isEmpty() || config.supabaseServiceKey.isEmpty() || config.ipAddress.isEmpty()) {
            throw new Exception("Configuração local inválida — por favor, pareie novamente.");
        }

        return config;
    }

    /**
     * Verifica se já existe configuração local
     */
    public static boolean hasLocalConfig() {
        return Files.exists(getConfigFilePath());
    }

    /**
     * Remove a configuração local (para re-parear)
     */
    public static boolean deleteLocalConfig() {
        try {
            return Files.deleteIfExists(getConfigFilePath());
        } catch (Exception e) {
            AppLogger.error("Erro ao deletar config local", e);
            return false;
        }
    }

    /**
     * Salva a config no arquivo local
     */
    public void saveToFile() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode root = mapper.createObjectNode();

        root.put("supabaseUrl", supabaseUrl);
        root.put("supabaseServiceKey", supabaseServiceKey);
        root.put("academyId", academyId);
        root.put("academyName", academyName);
        root.put("turnstileConfigId", turnstileConfigId);
        root.put("turnstileName", turnstileName);
        root.put("brand", brand);
        root.put("ipAddress", ipAddress);
        root.put("port", port);
        root.put("authUser", authUser);
        root.put("authPassword", authPassword);
        root.put("pairedAt", java.time.Instant.now().toString());

        String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
        Files.writeString(getConfigFilePath(), json);

        AppLogger.info("Configuração salva em: " + getConfigFilePath());
    }

    /**
     * Realiza o pareamento: chama a RPC redeem_pairing_code no Supabase
     * e retorna um ConfigParser já preenchido com todos os dados
     */
    public static ConfigParser redeemPairingCode(String supabaseUrl, String supabaseServiceKey, String pairingCode)
            throws Exception {
        SupabaseClient client = new SupabaseClient(supabaseUrl, supabaseServiceKey);
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode params = mapper.createObjectNode();
        params.put("p_code", pairingCode.trim());

        JsonNode result = client.rpc("redeem_pairing_code", params);

        // A RPC retorna um objeto com success, error, e os dados da config
        if (result == null) {
            throw new Exception("Resposta vazia do servidor.");
        }

        // Se vier como array (Supabase às vezes retorna array para RPC)
        if (result.isArray() && result.size() > 0) {
            result = result.get(0);
        }

        boolean success = result.has("success") && result.get("success").asBoolean();
        if (!success) {
            String error = result.has("error") ? result.get("error").asText() : "Código inválido ou expirado";
            throw new Exception(error);
        }

        ConfigParser config = fromPairingResult(supabaseUrl, supabaseServiceKey, result);
        config.saveToFile();

        return config;
    }

    /**
     * Valida se as credenciais do Supabase estão funcionando
     */
    public boolean validateConnection() {
        try {
            SupabaseClient client = new SupabaseClient(supabaseUrl, supabaseServiceKey);
            ObjectMapper mapper = new ObjectMapper();
            ObjectNode params = mapper.createObjectNode();
            params.put("p_code", "TEST_VALIDATION");
            client.rpc("redeem_pairing_code", params);
            return true;
        } catch (Exception e) {
            String msg = e.getMessage().toLowerCase();
            // 401/403 = credenciais inválidas; outros erros (ex: code inválido) significam
            // que a conexão funcionou
            return !msg.contains("401") && !msg.contains("403");
        }
    }

    // ─── Helpers ───

    private static String getField(JsonNode node, String field, String defaultValue) {
        return (node.has(field) && !node.get(field).isNull()) ? node.get(field).asText() : defaultValue;
    }

    private static Path getConfigFilePath() {
        // Salva no diretório de execução do app
        return Paths.get(System.getProperty("user.dir"), CONFIG_FILE_NAME);
    }

    // ─── Getters ───

    public String getSupabaseUrl() {
        return supabaseUrl;
    }

    public String getSupabaseServiceKey() {
        return supabaseServiceKey;
    }

    public String getAcademyId() {
        return academyId;
    }

    public String getAcademyName() {
        return academyName;
    }

    public String getTurnstileConfigId() {
        return turnstileConfigId;
    }

    public String getTurnstileName() {
        return turnstileName;
    }

    public String getBrand() {
        return brand;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public int getPort() {
        return port;
    }

    public String getAuthUser() {
        return authUser;
    }

    public String getAuthPassword() {
        return authPassword;
    }
}
