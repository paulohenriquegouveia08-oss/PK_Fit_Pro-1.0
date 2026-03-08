package com.pkfit.agent;

/**
 * Launcher class to bypass JavaFX main class modules check when running from a fat-jar.
 */
public class Launcher {
    public static void main(String[] args) {
        PkFitAgentDesktop.main(args);
    }
}
