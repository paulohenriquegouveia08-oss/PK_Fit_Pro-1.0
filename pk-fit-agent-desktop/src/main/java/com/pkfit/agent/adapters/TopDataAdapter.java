package com.pkfit.agent.adapters;

import com.pkfit.agent.core.AppLogger;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.util.function.Consumer;

public class TopDataAdapter implements TurnstileAdapter {

    private final String ip;
    private final int port;
    private Socket socket;
    private boolean connected = false;
    private Consumer<CredentialEvent> credentialCallback;
    private Thread listenerThread;

    // Commands TCP
    private static final byte[] PING = {0x02, 0x00, 0x01, 0x01, 0x03};
    private static final byte[] GRANT_CLOCKWISE = {0x02, 0x00, 0x02, 0x03, 0x01, 0x03};
    private static final byte[] GRANT_ANTICLOCKWISE = {0x02, 0x00, 0x02, 0x03, 0x02, 0x03};
    private static final byte[] DENY = {0x02, 0x00, 0x02, 0x03, 0x00, 0x03};

    public TopDataAdapter(String ip, int port) {
        this.ip = ip;
        this.port = (port != 0) ? port : 3570;
    }

    @Override
    public String getBrandName() {
        return "Top Data";
    }

    @Override
    public void connect() throws Exception {
        AppLogger.info("[Top Data] Conectando via TCP em " + ip + ":" + port);
        
        socket = new Socket(ip, port);
        socket.setSoTimeout(10000); 
        this.connected = true;

        // Send Ping
        sendCommand(PING);
        
        AppLogger.info("[Top Data] ✅ Conectado com sucesso!");
        
        // Start background listener
        startListener();
    }

    private void startListener() {
        if (listenerThread != null && listenerThread.isAlive()) return;
        
        listenerThread = new Thread(() -> {
            try {
                InputStream in = socket.getInputStream();
                byte[] buffer = new byte[1024];
                int bytesRead;

                while (connected && (bytesRead = in.read(buffer)) != -1) {
                    processPacket(buffer, bytesRead);
                }
            } catch (Exception e) {
                if (connected) {
                    AppLogger.error("[Top Data] Erro de leitura de Socket TCP", e);
                    handleDisconnect();
                }
            }
        });
        listenerThread.setDaemon(true);
        listenerThread.start();
    }
    
    private void handleDisconnect() {
        this.connected = false;
        try { if (socket != null && !socket.isClosed()) socket.close(); } catch (Exception ignored) {}
        AppLogger.warn("[Top Data] Conexão TCP Perdida.");
        // TODO: Try reconnect pattern 
    }

    private void processPacket(byte[] packet, int length) {
        if (length < 4) return;

        byte commandByte = packet[3];
        
        // 0x04 -> Card, 0x07 -> Bio
        if (commandByte == 0x04 || commandByte == 0x07) {
            String rawData = new String(packet, 4, length - 5).trim().replaceAll("\0", "");
            if (rawData != null && !rawData.isEmpty() && credentialCallback != null) {
                CredentialEvent.Type type = (commandByte == 0x04) ? CredentialEvent.Type.CARD : CredentialEvent.Type.BIOMETRIC;
                AppLogger.debug("[Top Data] Credencial Lida (" + type + "): " + rawData);
                credentialCallback.accept(new CredentialEvent(type, rawData));
            }
        }
    }

    @Override
    public void disconnect() throws Exception {
        this.connected = false;
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
        AppLogger.info("[Top Data] Desconectado");
    }

    @Override
    public boolean isConnected() {
        return connected;
    }

    @Override
    public void grantAccess(Direction direction) throws Exception {
        AppLogger.debug("[Top Data] Liberando catraca: " + direction);
        byte[] command = (direction == Direction.IN) ? GRANT_CLOCKWISE : GRANT_ANTICLOCKWISE;
        sendCommand(command);
    }

    @Override
    public void denyAccess() throws Exception {
        AppLogger.debug("[Top Data] Acesso Negado (Buzzer)");
        sendCommand(DENY);
    }

    @Override
    public void onCredentialRead(Consumer<CredentialEvent> callback) {
        this.credentialCallback = callback;
    }

    @Override
    public String getStatus() {
        if (!connected || socket == null || socket.isClosed()) {
            return "DISCONNECTED";
        }
        try {
            sendCommand(PING);
            return "CONNECTED";
        } catch (Exception e) {
            return "ERROR";
        }
    }

    private void sendCommand(byte[] command) throws Exception {
        if (socket != null && !socket.isClosed()) {
            OutputStream out = socket.getOutputStream();
            out.write(command);
            out.flush();
        } else {
            throw new Exception("Socket fechado. Não foi possível enviar comando");
        }
    }
}
