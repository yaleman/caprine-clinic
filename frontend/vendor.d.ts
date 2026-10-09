declare module '@splunk/react-search' {
    import type { ComponentType } from 'react';
    export const Bar: ComponentType<{
        options: Record<string, unknown>;
        onOptionsChange: (options: Record<string, unknown>) => void;
        onEventTrigger: (event: string) => void;
    }>;
}
