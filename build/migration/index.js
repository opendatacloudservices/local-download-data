"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wfsNameFix = exports.fixMissingDownloadedFiles = exports.moveCapabilities = exports.fixAbsPath = exports.fixOldDownloadNames = exports.fixOrphanFolders = exports.removeBanned = exports.downloadedFiles = exports.saveDownloadedFile = void 0;
const fs = require("fs");
const accept_1 = require("../accept");
const download_1 = require("../download");
const saveDownloadedFile = (client, download_id, file) => {
    return client
        .query('INSERT INTO "DownloadedFiles" (download_id, file) VALUES ($1, $2)', [download_id, file])
        .then(() => { });
};
exports.saveDownloadedFile = saveDownloadedFile;
const downloadedFiles = async (client) => {
    // await client.query('DELETE FROM "DownloadedFiles"');
    const downloadedFiles = await client
        .query('SELECT file FROM "DownloadedFiles"')
        .then(result => result.rows);
    const downloadMap = downloadedFiles.map(r => r.file.indexOf('/') > 0 ? r.file.split('/')[0] : r.file);
    let missing = 0;
    let inserted = 0;
    if (process.env.DOWNLOAD_LOCATION) {
        const files = fs.readdirSync(process.env.DOWNLOAD_LOCATION);
        console.log(files.length);
        for (let f = 0; f < files.length; f += 1) {
            const file = files[f];
            if (file !== '.' && file !== '..' && !downloadMap.includes(file)) {
                console.log(file);
                inserted++;
                const id = await client
                    .query('SELECT id FROM "Downloads" WHERE file = $1', [file])
                    .then(result => result.rowCount >= 1 ? parseInt(result.rows[0].id) : null);
                if (!id) {
                    console.log('missing', file);
                    missing += 1;
                }
                else {
                    if (fs
                        .lstatSync(process.env.DOWNLOAD_LOCATION + '/' + file)
                        .isDirectory()) {
                        const folderFiles = fs.readdirSync(process.env.DOWNLOAD_LOCATION + '/' + file);
                        for (let ff = 0; ff < folderFiles.length; ff += 1) {
                            const folderFile = folderFiles[ff];
                            if (folderFile !== '.' && folderFile !== '..') {
                                await (0, exports.saveDownloadedFile)(client, id, file + '/' + folderFile);
                            }
                        }
                    }
                    else {
                        await (0, exports.saveDownloadedFile)(client, id, file);
                    }
                }
            }
        }
    }
    console.log('missing', missing, inserted);
};
exports.downloadedFiles = downloadedFiles;
const removeBanned = async (client) => {
    const downloads = await client
        .query('SELECT id, url, format, file, mimetype FROM "Downloads"')
        .then(result => result.rows);
    console.log(downloads.length);
    let deletions = 0;
    const ignore = [];
    for (let d = 0; d < downloads.length; d += 1) {
        const download = downloads[d];
        if (!(0, accept_1.accept)(download)) {
            ignore.push(download.id);
            const fileLocation = process.env.DOWNLOAD_LOCATION + '/' + download.file;
            if (fs.existsSync(fileLocation)) {
                deletions++;
                const info = fs.lstatSync(fileLocation);
                if (info.isDirectory()) {
                    fs.rmdirSync(fileLocation);
                }
                else {
                    fs.unlinkSync(fileLocation);
                }
            }
        }
    }
    console.log(ignore.length);
    await client.query(`UPDATE "Downloads" SET state = 'ignore', file = NULL, downloaded = NULL WHERE id IN (${ignore.join(',')})`);
    console.log('deleted', deletions);
    console.log('done');
};
exports.removeBanned = removeBanned;
const fixOrphanFolders = async (client) => {
    const downloads = await client
        .query("SELECT id, url, format, file, state FROM \"Downloads\" WHERE state != 'ignore' AND state != 'failed' AND file IS NOT NULL")
        .then(result => result.rows);
    const missingDownloads = [];
    for (let d = 0; d < downloads.length; d += 1) {
        if (!fs.existsSync(process.env.DOWNLOAD_LOCATION + '/' + downloads[d].file)) {
            missingDownloads.push(downloads[d].id);
        }
    }
    if (missingDownloads.length > 0) {
        await client.query(`UPDATE "Downloads" SET state = 'updated', downloaded = NULL, file = NULL WHERE id in (${missingDownloads.join(',')})`);
    }
    const fileNames = downloads.map(d => d.file);
    let deletions = 0;
    if (process.env.DOWNLOAD_LOCATION) {
        const files = fs.readdirSync(process.env.DOWNLOAD_LOCATION);
        for (let f = 0; f < files.length; f += 1) {
            const file = files[f];
            if (file !== '.' && file !== '..') {
                if (fileNames.includes(file)) {
                    // console.log(f, files.length, 'ok');
                    // found
                }
                else {
                    deletions++;
                    const fileLocation = process.env.DOWNLOAD_LOCATION + '/' + file;
                    const info = fs.lstatSync(fileLocation);
                    if (info.isDirectory()) {
                        fs.rmdirSync(fileLocation, { recursive: true });
                    }
                    else {
                        fs.unlinkSync(fileLocation);
                    }
                }
            }
        }
    }
    console.log('done', deletions);
};
exports.fixOrphanFolders = fixOrphanFolders;
const fixOldDownloadNames = async (client) => {
    const downloads = await client
        .query('SELECT id, url, file FROM "Downloads" WHERE file IS NOT NULL')
        .then(result => result.rows);
    for (let d = 0; d < downloads.length; d += 1) {
        const download = downloads[d];
        if (download.file.match(/--/g).length >= 2) {
            const genName = (0, download_1.nameFromFile)(download);
            if (genName !== download.file) {
                fs.renameSync(process.env.DOWNLOAD_LOCATION + '/' + download.file, process.env.DOWNLOAD_LOCATION + '/' + genName);
                await client.query('UPDATE "Downloads" SET fixed_file = $1 WHERE id = $2', [genName, download.id]);
            }
        }
    }
    console.log('done');
};
exports.fixOldDownloadNames = fixOldDownloadNames;
const fixAbsPath = async (client) => {
    const files = await client
        .query('SELECT id, file FROM "DownloadedFiles" WHERE file LIKE $1', [
        `%${process.env.DOWNLOAD_LOCATION}%`,
    ])
        .then(result => result.rows);
    for (let f = 0; f < files.length; f += 1) {
        const file = files[f];
        console.log(f, files.length);
        if (file.file.indexOf(process.env.DOWNLOAD_LOCATION) >= 0) {
            const newName = file.file.split(process.env.DOWNLOAD_LOCATION).join('');
            console.log(file.file, newName);
            await client.query('UPDATE "DownloadedFiles" SET file = $1 WHERE id = $2', [newName, file.id]);
        }
    }
};
exports.fixAbsPath = fixAbsPath;
const moveCapabilities = () => {
    if (process.env.DOWNLOAD_LOCATION) {
        const files = fs.readdirSync(process.env.DOWNLOAD_LOCATION);
        for (let f = 0; f < files.length; f += 1) {
            if (files[f].indexOf('GetCapabilities.json') > 0 &&
                files[f].indexOf('GetCapabilities.json') ===
                    files[f].length - 'GetCapabilities.json'.length) {
                const folder = files[f].split('GetCapabilities.json')[0];
                if (!fs.existsSync(process.env.DOWNLOAD_LOCATION + folder)) {
                    fs.mkdirSync(process.env.DOWNLOAD_LOCATION + folder);
                }
                const stats = fs.statSync(process.env.DOWNLOAD_LOCATION + folder);
                if (stats.isDirectory()) {
                    fs.renameSync(process.env.DOWNLOAD_LOCATION + files[f], process.env.DOWNLOAD_LOCATION + folder + '/GetCapabilities.json');
                }
                else {
                    // system has already fixed / overcome this one...
                    fs.unlinkSync(process.env.DOWNLOAD_LOCATION + files[f]);
                }
            }
        }
    }
    console.log('done');
};
exports.moveCapabilities = moveCapabilities;
const fixMissingDownloadedFiles = async (client) => {
    const result = await client.query('SELECT id, file, download_id FROM "DownloadedFiles"');
    const missingFiles = [];
    const downloadIds = [];
    result.rows.forEach(r => {
        if (!fs.existsSync(process.env.DOWNLOAD_LOCATION + '/' + r.file)) {
            missingFiles.push(r.id);
            if (!downloadIds.includes(r.download_id)) {
                downloadIds.push(r.download_id);
            }
        }
    });
    if (missingFiles.length > 0) {
        await client.query(`DELETE FROM "DownloadedFiles" WHERE id IN (${missingFiles.join(',')})`);
        await client.query(`UPDATE "Downloads" SET state = 'updated' WHERE id IN (${downloadIds.join(',')})`);
    }
    console.log('done', missingFiles.length);
};
exports.fixMissingDownloadedFiles = fixMissingDownloadedFiles;
const wfsNameFix = async (client) => {
    const result = await client.query('SELECT id, file, download_id, layer_name FROM "DownloadedFiles" WHERE layer_name IS NOT NULL');
    let fixes = 0;
    let exists = 0;
    if (result.rows) {
        for (let ri = 0; ri < result.rows.length; ri += 1) {
            const r = result.rows[ri];
            if (!fs.existsSync(process.env.DOWNLOAD_LOCATION + '/' + r.file)) {
                const altName = r.file.toString().substr(0, r.file.indexOf('/')) +
                    '/layer_' +
                    r.file.split('layer_')[1].split('_')[0] +
                    '_' +
                    r.layer_name.split(':')[1] +
                    '.gpkg';
                if (fs.existsSync(process.env.DOWNLOAD_LOCATION + '/' + altName)) {
                    try {
                        await client.query('UPDATE "DownloadedFiles" SET file = $1 WHERE id = $2', [altName, r.id]);
                        fixes += 1;
                    }
                    catch (err) {
                        exists += 1;
                    }
                }
            }
        }
    }
    console.log(result.rows.length, fixes, exists);
};
exports.wfsNameFix = wfsNameFix;
//# sourceMappingURL=index.js.map