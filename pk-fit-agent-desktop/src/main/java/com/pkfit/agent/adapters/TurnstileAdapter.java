package com.pkfit.agent.adapters;

import java.util.function.Consumer;

public interface TurnstileAdapter {
    
    enum Direction {
        IN, OUT
    }

    String getBrandName();

    void connect() throws Exception;

    void disconnect() throws Exception;

    boolean isConnected();

    void grantAccess(Direction direction) throws Exception;

    void denyAccess() throws Exception;

    void onCredentialRead(Consumer<CredentialEvent> callback);

    String getStatus() throws Exception;
}
