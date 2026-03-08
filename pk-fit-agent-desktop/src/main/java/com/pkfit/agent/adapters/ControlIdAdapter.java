package com.pkfit.agent.adapters;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pkfit.agent.core.AppLogger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Timer;
import java.util.TimerTask;
import java.util.function.Consumer;

public class ControlIdAdapter implements TurnstileAdapter {

    private final String ip;
    private final int port;
    private final String authUser;
    private final String authPassword;

    private boolean connected = false;
    private Consumer<CredentialEvent> credentialCallback;
    private HttpClient httpClient;
    private ObjectMapper mapper;
    
    private Timer pollingTimer;
    private int lastEventId = 0;

    public ControlIdAdapter(String ip, int port, String authUser, String authPassword) {
        this.ip = ip;
        this.port = port;
        this.authUser = authUser;
        this.authPassword = authPassword;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.mapper = new ObjectMapper();
    }

    private String getBaseUrl() {
        return "http://" + ip + ":" + port;
    }

    private String getAuthHeader() {
        if (authUser != null && !authUser.isEmpty() && authPassword != null && !authPassword.isEmpty()) {
            String credentials = authUser + ":" + authPassword;
            return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes());
        }
        return null;
    }

    private JsonNode request(String endpoint, String jsonBody) throws Exception {
        String url = getBaseUrl() + endpoint;
        HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create(url));

        String authHeader = getAuthHeader();
        if (authHeader != null) {
            builder.header("Authorization", authHeader);
        }

        if (jsonBody != null) {
            builder.header("Content-Type", "application/json")
                   .POST(HttpRequest.BodyPublishers.ofString(jsonBody));
        } else {
            builder.GET();
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new Exception("HTTP " + response.statusCode());
        }

        return mapper.readTree(response.body());
    }

    @Override
    public String getBrandName() {
        return "Control ID";
    }

    @Override
    public void connect() throws Exception {
        AppLogger.info("[Control ID] Conectando à catraca em " + ip + ":" + port + "...");
        
        try {
            request("/get_catra_info.fcgi", null);
            this.connected = true;
            AppLogger.info("[Control ID] ✅ Conectado com sucesso!");
            
            startEventPolling();
        } catch (Exception e) {
            this.connected = false;
            AppLogger.error("[Control ID] ❌ Falha na conexão", e);
            throw new Exception("Não foi possível conectar à catraca Control ID.");
        }
    }

    @Override
    public void disconnect() throws Exception {
        if (pollingTimer != null) {
            pollingTimer.cancel();
            pollingTimer = null;
        }
        this.connected = false;
        AppLogger.info("[Control ID] Desconectado");
    }

    @Override
    public boolean isConnected() {
        return connected;
    }

    @Override
    public void grantAccess(Direction direction) throws Exception {
        String allow = direction == Direction.IN ? "clockwise" : "anticlockwise";
        AppLogger.debug("[Control ID] Liberando catraca: " + allow);
        String body = "{\"actions\":[{\"action\":\"catra\",\"parameters\":{\"allow\":\"" + allow + "\"}}]}";
        request("/execute_actions.fcgi", body);
    }

    @Override
    public void denyAccess() throws Exception {
        AppLogger.debug("[Control ID] Acesso negado");
        String body = "{\"actions\":[{\"action\":\"catra\",\"parameters\":{\"allow\":\"none\"}}]}";
        try { request("/execute_actions.fcgi", body); } catch (Exception ignored) {}
    }

    @Override
    public void onCredentialRead(Consumer<CredentialEvent> callback) {
        this.credentialCallback = callback;
    }

    private void startEventPolling() {
        if (pollingTimer != null) return;
        
        pollingTimer = new Timer(true);
        pollingTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                if (!connected || credentialCallback == null) return;
                try {
                    String body = "{\"object\":\"access_logs\",\"limit\":1,\"order\":\"desc\"}";
                    JsonNode resp = request("/load_objects.fcgi", body);
                    
                    if (resp.has("access_logs") && resp.get("access_logs").size() > 0) {
                        JsonNode log = resp.get("access_logs").get(0);
                        int id = log.has("id") ? log.get("id").asInt() : 0;
                        
                        if (id > lastEventId) {
                            lastEventId = id;
                            int event = log.has("event") ? log.get("event").asInt() : 0;
                            String rawValue = log.has("card_id") ? log.get("card_id").asText() 
                                    : (log.has("user_id") ? log.get("user_id").asText() : String.valueOf(id));

                            CredentialEvent.Type type = CredentialEvent.Type.CARD;
                            if (event == 7 || event == 8) type = CredentialEvent.Type.BIOMETRIC;
                            if (event == 13) type = CredentialEvent.Type.FACIAL;
                            if (event == 10) type = CredentialEvent.Type.QR_CODE;

                            AppLogger.debug("[Control ID] Lida: " + type + " - " + rawValue);
                            credentialCallback.accept(new CredentialEvent(type, rawValue));
                        }
                    }
                } catch (Exception ignored) {}
            }
        }, 0, 500); // 500ms
    }

    @Override
    public String getStatus() throws Exception {
        if (!connected) return "DISCONNECTED";
        try {
            request("/get_catra_info.fcgi", null);
            return "CONNECTED";
        } catch (Exception e) {
            return "ERROR";
        }
    }
}
