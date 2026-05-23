import { useState, useEffect } from 'react';
import './welcome-overlay.css';

interface WelcomeOverlayProps {
    userName: string;
    academyName?: string;
    onComplete?: () => void;
}

export default function WelcomeOverlay({ userName, academyName, onComplete }: WelcomeOverlayProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        // Animation sequence:
        // 1. Show for 3 seconds
        const hideTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 3000);

        // 2. Remove from DOM after fade out transition (0.5s)
        const unmountTimer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) onComplete();
        }, 3500);

        return () => {
            clearTimeout(hideTimer);
            clearTimeout(unmountTimer);
        };
    }, [onComplete]);

    if (!isVisible) return null;

    return (
        <div className={`welcome-overlay ${isFadingOut ? 'fade-out' : ''}`}>
            <div className="welcome-content">
                <div className="welcome-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                <h1 className="welcome-title">Bem-vindo(a), {userName}!</h1>
                {academyName && (
                    <p className="welcome-subtitle">à {academyName}</p>
                )}
            </div>
        </div>
    );
}
