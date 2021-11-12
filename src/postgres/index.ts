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
          OR state = 'updated'
         LIMIT  1
      )
      RETURNING id;`
    )
    .then(result => {
      if (result.rowCount === 0) {
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
        if (result.rowCount === 0) {
          reject('nothing found');
        } else {
          resolve(result.rows[0]);
        }
      });
    });
};

export const updateFile = (
  client: Client,
  file: File,
  files: string[],
  layers?: string[]
): Promise<void> => {
  const fileValues: (number | string | null)[] = [];
  const fileRemovals: (number | string | null)[][] = [];
  let insertString = '';
  files.forEach((f, fi) => {
    fileRemovals.push([file.id, f, layers ? layers[fi] : null]);
    fileValues.push(file.id, f, layers ? layers[fi] : null);
    insertString += `${fi > 0 ? ',' : ''}($${fi * 3 + 1}, $${fi * 3 + 2}, $${
      fi * 3 + 3
    })`;
  });

  return client
    .query(
      `UPDATE "Downloads" SET
      state = $1,
      file = $2,
      downloaded = $3
    WHERE id = $4`,
      [file.state, file.file, new Date().toISOString(), file.id]
    )
    .then(() =>
      Promise.all(
        fileRemovals.map(fileValue =>
          client.query(
            'DELETE FROM "DownloadedFiles" WHERE download_id = $1 AND file = $2 AND layer_name = $3',
            fileValue
          )
        )
      )
    )
    .then(() =>
      client.query(
        `INSERT INTO "DownloadedFiles" (download_id, file, layer_name) VALUES ${insertString}`,
        fileValues
      )
    )
    .then(() => {});
};

export const failedFile = (client: Client, fileId: number): Promise<void> => {
  return client
    .query(
      `UPDATE "Downloads" SET
      downloaded = $1,
      state = 'failed'
    WHERE id = $2`,
      [new Date().toISOString(), fileId]
    )
    .then(() => {});
};
