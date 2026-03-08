package com.pkfit.agent.adapters;

import java.util.Date;

public class CredentialEvent {

    public enum Type {
        BIOMETRIC, CARD, QR_CODE, FACIAL
    }

    private Type type;
    private String rawValue;
    private Date timestamp;

    public CredentialEvent(Type type, String rawValue) {
        this.type = type;
        this.rawValue = rawValue;
        this.timestamp = new Date();
    }

    public Type getType() {
        return type;
    }

    public String getRawValue() {
        return rawValue;
    }

    public Date getTimestamp() {
        return timestamp;
    }
}
