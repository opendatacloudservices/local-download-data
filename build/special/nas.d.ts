import type { File } from '../types';
export declare const nas: (file: File, fileName: string) => Promise<null | {
    source: string;
    files: string[];
}>;
