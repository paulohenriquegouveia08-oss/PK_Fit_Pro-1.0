package com.pkfit.agent.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AppLogger {
    private static final Logger logger = LoggerFactory.getLogger(AppLogger.class);

    public static void info(String message) {
        logger.info(message);
    }

    public static void debug(String message) {
        logger.debug(message);
    }

    public static void error(String message, Throwable t) {
        if (t != null) {
            logger.error(message, t);
        } else {
            logger.error(message);
        }
    }

    public static void warn(String message) {
        logger.warn(message);
    }
}
