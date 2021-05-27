/// <reference types="node" />
import { File } from './types';
export declare const nameFromFile: (file: File) => string;
export declare const endInterval: (interval: null | NodeJS.Timeout) => void;
export declare const directDownload: (file: File, name: string) => Promise<string>;
export declare const download: (file: File) => Promise<string | false>;
