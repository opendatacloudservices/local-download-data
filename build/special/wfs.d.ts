import { ExecException } from 'child_process';
import type { File } from '../types';
export declare const isWfs: (url: string) => Promise<boolean>;
export declare const removeRequests: (url: string) => string;
export declare const prepareWfsUrl: (url: string) => string;
export declare const getCapabilities: (url: string, target: string, deleteAfter?: boolean) => Promise<{
    [index: string]: {
        [index: string]: {
            [index: string]: {
                Name?: string | undefined;
            } | {
                Name?: string | undefined;
            }[];
        };
    };
} | null>;
export declare const wfs: (file: File, fileName: string) => Promise<{
    source: string;
    files: string[];
    layers: string[];
}>;
export declare const removeOgr2ogr: (folder: string, fi: number, feature: string) => void;
export declare const ogr2ogrUrlPrepare: (url: string) => string;
export declare const ogr2ogr: (folder: string, fi: number, feature: string, url: string, error: (err: ExecException) => void, callback: (stdout: string, stderr: string) => void) => void;
