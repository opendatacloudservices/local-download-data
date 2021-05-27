"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetFiles = exports.failedFile = exports.updateFile = exports.getFile = exports.getNextDownload = exports.getDownloadList = void 0;
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
         LIMIT  1
      )
      RETURNING id;`)
        .then(result => {
        if (result.rows.length === 0) {
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
            if (result.rows.length === 0) {
                reject('nothing found');
            }
            else {
                resolve(result.rows[0]);
            }
        });
    });
};
exports.getFile = getFile;
const updateFile = (client, file) => {
    return client
        .query(`UPDATE "Downloads" SET
      state = $1,
      file = $2,
      downloaded = $3
    WHERE id = $4`, [file.state, file.file, new Date().toISOString(), file.id])
        .then(() => { });
};
exports.updateFile = updateFile;
const failedFile = (client, fileId) => {
    return client
        .query(`UPDATE "Downloads" SET
      state = 'failed'
    WHERE id = $1`, [fileId])
        .then(() => { });
};
exports.failedFile = failedFile;
const resetFiles = (client) => {
    return client
        .query(`UPDATE "Downloads" SET
      state = 'updated'
      WHERE state = 'downloading'`)
        .then(() => { });
};
exports.resetFiles = resetFiles;
//# sourceMappingURL=index.js.map