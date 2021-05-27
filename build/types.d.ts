export interface Dataset {
    id: number;
    harvester: string;
    harvester_instance_id: string;
    meta_name: string;
    meta_license: string;
    meta_created: Date;
    meta_modified: Date;
    meta_owner: string;
    harvester_dataset_id: number;
}
export interface File {
    id: number;
    url: string;
    file: string;
    state: 'new' | 'updated' | 'downloaded' | 'downloading' | 'ignore' | 'failed';
    downloaded: Date;
    format: string;
    mimetype: string;
}
