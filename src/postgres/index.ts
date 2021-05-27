import {Client} from 'pg';
import {File} from '../types';

export const getDownloadList = (
  client: Client,
  limit?: number
): Promise<File[]> => {
  return client
    .query(
      `SELECT * FROM "Downloads" WHERE state = 'new'${
        limit ? ' LIMIT ' + limit : ''
      }`
    )
    .then(result => {
      return result.rows;
    });
};

export const getNextDownload = (client: Client): Promise<number | null> => {
  return client
    .query(
      `UPDATE "Downloads"
       SET state = 'downloading' 
       WHERE id = (
         SELECT id
         FROM   "Downloads"
         WHERE  state = 'new'
         LIMIT  1
      )
      RETURNING id;`
    )
    .then(result => {
      if (result.rows.length === 0) {
        return null;
      } else {
        return result.rows[0].id;
      }
    });
};

export const getFile = (client: Client, id: number): Promise<File> => {
  return client
    .query('SELECT * FROM "Downloads" WHERE id = $1', [id])
    .then(result => {
      return new Promise((resolve, reject) => {
        if (result.rows.length === 0) {
          reject('nothing found');
        } else {
          resolve(result.rows[0]);
        }
      });
    });
};

export const updateFile = (client: Client, file: File): Promise<void> => {
  return client
    .query(
      `UPDATE "Downloads" SET
      state = $1,
      file = $2,
      downloaded = $3
    WHERE id = $4`,
      [file.state, file.file, new Date().toISOString(), file.id]
    )
    .then(() => {});
};

export const failedFile = (client: Client, fileId: number): Promise<void> => {
  return client
    .query(
      `UPDATE "Downloads" SET
      state = 'failed'
    WHERE id = $1`,
      [fileId]
    )
    .then(() => {});
};

export const resetFiles = (client: Client): Promise<void> => {
  return client
    .query(
      `UPDATE "Downloads" SET
      state = 'updated'
      WHERE state = 'downloading'`
    )
    .then(() => {});
};
