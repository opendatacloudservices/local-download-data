import { File } from './types';
import { Client } from 'pg';
export declare const nameFromFile: (file: File) => string;
export declare const download: (file: File) => Promise<{
    source: string;
    files: string[];
    layers?: string[];
} | false | null>;
export declare const resetMissingDownloads: (client: Client) => Promise<void>;
export declare const resetDownloads: (client: Client) => Promise<void>;
export declare const removeEmpty: (client: Client) => Promise<void>;
