package com.pkfit.agent.adapters;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pkfit.agent.core.AppLogger;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Timer;
import java.util.TimerTask;
import java.util.function.Consumer;

public class HenryAdapter implements TurnstileAdapter {

    private final String ip;
    private final int port;
    private final String authUser;
    private final String authPassword;

    private boolean connected = false;
    private boolean tcpConnected = false;
    private Socket tcpSocket;

    private Consumer<CredentialEvent> credentialCallback;
    private HttpClient httpClient;
    private ObjectMapper mapper;

    private Timer httpPollingTimer;
    private int lastEventId = 0;
    private Thread tcpListenerThread;

    public HenryAdapter(String ip, int port, String authUser, String authPassword) {
        this.ip = ip;
        this.port = (port != 0) ? port : 80;
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
        if (authUser != null && authPassword != null) {
            String credentials = authUser + ":" + authPassword;
            return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes());
        }
        return null;
    }

    private JsonNode httpRequest(String endpoint, String method, String jsonBody) throws Exception {
        String url = getBaseUrl() + endpoint;
        HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create(url));

        String authHeader = getAuthHeader();
        if (authHeader != null)
            builder.header("Authorization", authHeader);

        if (jsonBody != null) {
            builder.header("Content-Type", "application/json");
            if (method.equals("POST"))
                builder.POST(HttpRequest.BodyPublishers.ofString(jsonBody));
        } else {
            builder.GET();
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400)
            throw new Exception("HTTP " + response.statusCode());

        String type = response.headers().firstValue("Content-Type").orElse("");
        if (type.contains("application/json"))
            return mapper.readTree(response.body());

        return null;
    }

    @Override
    public String getBrandName() {
        return "Henry";
    }

    @Override
    public void connect() throws Exception {
        AppLogger.info("[Henry] Conectando ao equipamento em " + ip + "...");

        try {
            httpRequest("/api/system/status", "GET", null);
            AppLogger.info("[Henry] ✅ Conexão HTTP estabelecida");
        } catch (Exception e) {
            AppLogger.warn("[Henry] ⚠️ App web não respondeu (" + e.getMessage() + ")");
        }

        try {
            connectTcp();
        } catch (Exception e) {
            AppLogger.warn("[Henry] ⚠️ TCP não disponível: " + e.getMessage());
        }

        this.connected = true;
        AppLogger.info("[Henry] ✅ Conectado com sucesso!");
    }

    private void connectTcp() throws Exception {
        tcpSocket = new Socket(ip, 3000);
        tcpSocket.setSoTimeout(0); // Infinite wait
        tcpConnected = true;
        AppLogger.info("[Henry] ✅ Conexão TCP estabelecida na porta 3000");

        tcpListenerThread = new Thread(() -> {
            try {
                InputStream in = tcpSocket.getInputStream();
                byte[] buffer = new byte[1024];
                int bytesRead;

                while (tcpConnected && (bytesRead = in.read(buffer)) != -1) {
                    processTcpPacket(buffer, bytesRead);
                }
            } catch (Exception e) {
                if (tcpConnected) {
                    AppLogger.error("[Henry] Erro TCP", e);
                    tcpConnected = false;
                }
            }
        });
        tcpListenerThread.setDaemon(true);
        tcpListenerThread.start();
    }

    private void processTcpPacket(byte[] packet, int length) {
        if (length < 3)
            return;
        byte commandType = packet[2];

        try {
            if (commandType == 0x01 || commandType == 0x02) { // Card
                String cardData = new String(packet, 3, length - 3).trim().replaceAll("\0", "");
                if (credentialCallback != null)
                    credentialCallback.accept(new CredentialEvent(CredentialEvent.Type.CARD, cardData));
            } else if (commandType == 0x03) { // Bio
                String bioId = new String(packet, 3, length - 3).trim().replaceAll("\0", "");
                if (credentialCallback != null)
                    credentialCallback.accept(new CredentialEvent(CredentialEvent.Type.BIOMETRIC, bioId));
            }
        } catch (Exception e) {
        }
    }

    @Override
    public void disconnect() throws Exception {
        if (httpPollingTimer != null) {
            httpPollingTimer.cancel();
            httpPollingTimer = null;
        }
        tcpConnected = false;
        if (tcpSocket != null && !tcpSocket.isClosed())
            tcpSocket.close();
        connected = false;
        AppLogger.info("[Henry] Desconectado");
    }

    @Override
    public boolean isConnected() {
        return connected;
    }

    @Override
    public void grantAccess(Direction direction) throws Exception {
        try {
            String dir = direction == Direction.IN ? "clockwise" : "anticlockwise";
            httpRequest("/api/access/grant", "POST", "{\"direction\":\"" + dir + "\"}");
            AppLogger.debug("[Henry] Catraca liberada via HTTP (" + direction + ")");
        } catch (Exception e) {
            if (tcpConnected && tcpSocket != null) {
                byte dirByte = (byte) (direction == Direction.IN ? 0x01 : 0x02);
                byte[] cmd = { 0x02, 0x03, 0x10, dirByte, 0x03 };
                OutputStream out = tcpSocket.getOutputStream();
                out.write(cmd);
                out.flush();
                AppLogger.debug("[Henry] Catraca liberada via TCP (" + direction + ")");
            } else {
                throw new Exception("Falha ao liberar catraca — sem comunicação");
            }
        }
    }

    @Override
    public void denyAccess() throws Exception {
        AppLogger.debug("[Henry] Acesso negado");
        try {
            httpRequest("/api/access/deny", "POST", "{}");
        } catch (Exception e) {
        }
    }

    @Override
    public void onCredentialRead(Consumer<CredentialEvent> callback) {
        this.credentialCallback = callback;
        if (!tcpConnected)
            startHttpPolling();
    }

    private void startHttpPolling() {
        if (httpPollingTimer != null)
            return;
        httpPollingTimer = new Timer(true);
        httpPollingTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                if (!connected || credentialCallback == null)
                    return;
                try {
                    JsonNode resp = httpRequest("/api/access/events?limit=1&order=desc", "GET", null);
                    if (resp != null && resp.has("events") && resp.get("events").size() > 0) {
                        JsonNode last = resp.get("events").get(0);
                        int id = last.has("id") ? last.get("id").asInt() : 0;
                        if (id > lastEventId) {
                            lastEventId = id;
                            String typeStr = last.has("type") ? last.get("type").asText() : "card";
                            String raw = last.has("credential") ? last.get("credential").asText() : String.valueOf(id);

                            CredentialEvent.Type type = CredentialEvent.Type.CARD;
                            if (typeStr.contains("bio"))
                                type = CredentialEvent.Type.BIOMETRIC;
                            if (typeStr.contains("fac"))
                                type = CredentialEvent.Type.FACIAL;
                            if (typeStr.contains("qr"))
                                type = CredentialEvent.Type.QR_CODE;

                            AppLogger.debug("[Henry] Credencial via HTTP: " + type + " - " + raw);
                            credentialCallback.accept(new CredentialEvent(type, raw));
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }, 0, 1000);
    }

    @Override
    public String getStatus() throws Exception {
        if (!connected)
            return "DISCONNECTED";
        try {
            httpRequest("/api/system/status", "GET", null);
            return "CONNECTED";
        } catch (Exception e) {
            return tcpConnected ? "CONNECTED" : "ERROR";
        }
    }
}
