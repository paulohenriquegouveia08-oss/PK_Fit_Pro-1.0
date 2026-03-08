import React from 'react';

export interface MenuItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    isCenter?: boolean;
}
