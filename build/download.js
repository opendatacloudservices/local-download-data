"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEmpty = exports.resetDownloads = exports.resetMissingDownloads = exports.download = exports.nameFromFile = void 0;
const fs = require("fs");
const accept_1 = require("./accept");
const wfs_1 = require("./special/wfs");
const nas_1 = require("./special/nas");
const utils_1 = require("./utils");
const nameFromFile = (file) => {
    let name = file.url.substr(file.url.lastIndexOf('/') + 1);
    if (name.indexOf('?') > -1) {
        name = name.substr(0, name.indexOf('?'));
    }
    name = name.replace(/[^a-zA-Z0-9._-]/g, '');
    return `${file.id}--${name}`;
};
exports.nameFromFile = nameFromFile;
const download = (file) => {
    const targetName = (0, exports.nameFromFile)(file);
    const targetLocation = process.env.DOWNLOAD_LOCATION + '/' + targetName;
    if ((0, accept_1.accept)(file)) {
        if (file.format && file.format.toLowerCase() === 'wfs') {
            return (0, wfs_1.isWfs)(file.url).then(wfsCheck => {
                if (wfsCheck) {
                    return (0, wfs_1.wfs)(file, targetName);
                }
                else {
                    return (0, utils_1.directDownload)(file.url, targetLocation).then(() => {
                        return { source: targetName, files: [targetName] };
                    });
                }
            });
        }
        else if (file.format && file.format.toLowerCase() === 'nas') {
            return (0, nas_1.nas)(file, targetName);
        }
        else if (file.format && file.format.toLowerCase() === 'download') {
            return (0, wfs_1.isWfs)(file.url).then(wfsCheck => {
                if (wfsCheck) {
                    return (0, wfs_1.wfs)(file, targetName);
                }
                else {
                    return (0, utils_1.directDownload)(file.url, targetLocation).then(() => {
                        return { source: targetName, files: [targetName] };
                    });
                }
            });
        }
        else {
            return (0, utils_1.directDownload)(file.url, targetLocation).then(() => {
                return { source: targetName, files: [targetName] };
            });
        }
    }
    else {
        return Promise.resolve(false);
    }
};
exports.download = download;
const resetMissingDownloads = async (client) => {
    const downloads = await client
        .query("SELECT id, url, format, file FROM \"Downloads\" WHERE state != 'ignore' AND state != 'failed' AND file IS NOT NULL")
        .then(result => result.rows);
    const missingDownloads = [];
    for (let d = 0; d < downloads.length; d += 1) {
        if (!fs.existsSync(process.env.DOWNLOAD_LOCATION + '/' + downloads[d].file)) {
            missingDownloads.push(downloads[d].id);
        }
    }
    if (missingDownloads.length > 0) {
        await client.query(`UPDATE "Downloads" SET file = NULL, downloaded = NULL, state = 'updated' WHERE id IN (${missingDownloads.join(',')})`);
    }
};
exports.resetMissingDownloads = resetMissingDownloads;
const resetDownloads = async (client) => {
    const downloads = await client
        .query('SELECT file FROM "Downloads" WHERE state = \'downloading\'')
        .then(result => result.rows || []);
    for (let d = 0; d < downloads.length; d += 1) {
        const fileLocation = process.env.DOWNLOAD_LOCATION + '/' + downloads[d].file;
        if (fs.existsSync(fileLocation)) {
            const info = fs.lstatSync(fileLocation);
            if (info.isDirectory()) {
                fs.rmdirSync(fileLocation, { recursive: true });
            }
            else {
                fs.unlinkSync(fileLocation);
            }
        }
    }
    return client
        .query(`UPDATE "Downloads" SET
      state = 'updated'
      WHERE state = 'downloading'`)
        .then(() => { });
};
exports.resetDownloads = resetDownloads;
const removeEmpty = async (client) => {
    const downloads = await client
        .query("SELECT id, file, format FROM \"Downloads\" WHERE (state = 'downloaded' OR state = 'downloading') AND (fails IS NULL OR fails < 5)")
        .then(result => result.rows || []);
    const downloadedFiles = downloads.map(d => d.file);
    if (process.env.DOWNLOAD_LOCATION) {
        const files = fs.readdirSync(process.env.DOWNLOAD_LOCATION);
        for (let f = 0; f < files.length; f += 1) {
            const file = files[f];
            const stats = fs.statSync(process.env.DOWNLOAD_LOCATION + file);
            if (file !== '.' && file !== '..') {
                const fileIndex = downloadedFiles.indexOf(file);
                if (stats.isDirectory()) {
                    let isEmpty = true;
                    let onlyGetCapabilities = false;
                    const contents = fs.readdirSync(process.env.DOWNLOAD_LOCATION + file);
                    for (let c = 0; c < contents.length; c += 1) {
                        const content = contents[c];
                        if (content !== '.' && content !== '..') {
                            const contentPath = process.env.DOWNLOAD_LOCATION + file + '/' + content;
                            const cStats = fs.statSync(contentPath);
                            if (cStats.size === 0 || content === 'GetCapabilities.json') {
                                if (content !== 'GetCapabilities.json') {
                                    fs.unlinkSync(contentPath);
                                }
                                else {
                                    onlyGetCapabilities = true;
                                }
                            }
                            else {
                                isEmpty = false;
                            }
                        }
                    }
                    if (isEmpty) {
                        if (onlyGetCapabilities) {
                            fs.unlinkSync(process.env.DOWNLOAD_LOCATION + file + '/GetCapabilities.json');
                        }
                        if (fileIndex > -1) {
                            await client.query(`UPDATE "Downloads" SET state = '${downloads[fileIndex].format === 'wfs' ? 'updated' : 'failed'}', file = NULL, fails = $1 WHERE id = $2`, [
                                downloads[fileIndex].fails
                                    ? downloads[fileIndex].fails + 1
                                    : 1,
                                downloads[fileIndex].id,
                            ]);
                        }
                        fs.rmdirSync(process.env.DOWNLOAD_LOCATION + file, {
                            recursive: true,
                        });
                    }
                }
                else if (stats.size === 0) {
                    if (fileIndex > -1) {
                        await client.query('UPDATE "Downloads" SET state = \'failed\', file = NULL WHERE id = $1', [downloads[fileIndex].id]);
                    }
                    fs.unlinkSync(process.env.DOWNLOAD_LOCATION + file);
                }
            }
        }
    }
};
exports.removeEmpty = removeEmpty;
//# sourceMappingURL=download.js.map