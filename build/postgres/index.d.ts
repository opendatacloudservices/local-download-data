import { Client } from 'pg';
import { File } from '../types';
export declare const getDownloadList: (client: Client, limit?: number | undefined) => Promise<File[]>;
export declare const getNextDownload: (client: Client) => Promise<number | null>;
export declare const getFile: (client: Client, id: number) => Promise<File>;
export declare const updateFile: (client: Client, file: File, files: string[], layers?: string[] | undefined) => Promise<void>;
export declare const failedFile: (client: Client, fileId: number) => Promise<void>;
