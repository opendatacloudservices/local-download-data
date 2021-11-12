"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failedFile = exports.updateFile = exports.getFile = exports.getNextDownload = exports.getDownloadList = void 0;
const getDownloadList = (client, limit) => {
    return client
        .query(`SELECT * FROM "Downloads" WHERE state = 'new'${limit ? ' LIMIT ' + limit : ''}`)
        .then(result => {
        return result.rows;
    });
};
exports.getDownloadList = getDownloadList;
const getNextDownload = (client) => {
    return client
        .query(`UPDATE "Downloads"
       SET state = 'downloading' 
       WHERE id = (
         SELECT id
         FROM   "Downloads"
         WHERE  state = 'new'
          OR state = 'updated'
         LIMIT  1
      )
      RETURNING id;`)
        .then(result => {
        if (result.rowCount === 0) {
            return null;
        }
        else {
            return result.rows[0].id;
        }
    });
};
exports.getNextDownload = getNextDownload;
const getFile = (client, id) => {
    return client
        .query('SELECT * FROM "Downloads" WHERE id = $1', [id])
        .then(result => {
        return new Promise((resolve, reject) => {
            if (result.rowCount === 0) {
                reject('nothing found');
            }
            else {
                resolve(result.rows[0]);
            }
        });
    });
};
exports.getFile = getFile;
const updateFile = (client, file, files, layers) => {
    const fileValues = [];
    const fileRemovals = [];
    let insertString = '';
    files.forEach((f, fi) => {
        fileRemovals.push([file.id, f, layers ? layers[fi] : null]);
        fileValues.push(file.id, f, layers ? layers[fi] : null);
        insertString += `${fi > 0 ? ',' : ''}($${fi * 3 + 1}, $${fi * 3 + 2}, $${fi * 3 + 3})`;
    });
    return client
        .query(`UPDATE "Downloads" SET
      state = $1,
      file = $2,
      downloaded = $3
    WHERE id = $4`, [file.state, file.file, new Date().toISOString(), file.id])
        .then(() => Promise.all(fileRemovals.map(fileValue => client.query('DELETE FROM "DownloadedFiles" WHERE download_id = $1 AND file = $2 AND layer_name = $3', fileValue))))
        .then(() => client.query(`INSERT INTO "DownloadedFiles" (download_id, file, layer_name) VALUES ${insertString}`, fileValues))
        .then(() => { });
};
exports.updateFile = updateFile;
const failedFile = (client, fileId) => {
    return client
        .query(`UPDATE "Downloads" SET
      downloaded = $1,
      state = 'failed'
    WHERE id = $2`, [new Date().toISOString(), fileId])
        .then(() => { });
};
exports.failedFile = failedFile;
//# sourceMappingURL=index.js.map