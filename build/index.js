"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const pg_1 = require("pg");
const node_fetch_1 = require("node-fetch");
const index_1 = require("./postgres/index");
const pm2 = require("local-pm2-config");
const download_1 = require("./download");
// get environmental variables
dotenv.config({ path: path.join(__dirname, '../.env') });
const local_microservice_1 = require("local-microservice");
const local_logger_1 = require("local-logger");
// number of parallel processes
let processCount = 1;
pm2.apps.forEach(app => {
    if (app.name === 'local-ckan-harvester') {
        processCount = app.max;
    }
});
const progress = {
    active: false,
    count: 0,
};
// connect to postgres (via env vars params)
const client = new pg_1.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
});
client
    .connect()
    .then(() => {
    return index_1.resetFiles(client);
})
    .catch(err => {
    local_logger_1.logError({ message: err });
});
/**
 * @swagger
 *
 * /download/all:
 *   get:
 *     operationId: getDownloadAll
 *     description: download all datasets marked as new or updated
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
local_microservice_1.api.get('/download/all', async (req, res) => {
    if (!progress.active) {
        progress.active = true;
        const parallelCount = 3 * processCount;
        const fetchs = [];
        for (let i = 0; i < parallelCount; i += 1) {
            progress.count += 1;
            fetchs.push(node_fetch_1.default(local_logger_1.addToken(`http://localhost:${process.env.PORT}/download/next`, res)));
        }
        await Promise.all(fetchs);
        res.status(200).json({ message: 'Download initiated' });
    }
    else {
        res.status(200).json({ message: 'Download already in progress' });
    }
});
/**
 * @swagger
 *
 * /download/next:
 *   get:
 *     operationId: getNext
 *     description: check if there is something to download and then start next file
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
local_microservice_1.api.get('/download/next', (req, res) => {
    index_1.getNextDownload(client)
        .then(async (result) => {
        if (result) {
            if (!progress.active) {
                progress.active = true;
            }
            await node_fetch_1.default(local_logger_1.addToken(`http://localhost:${process.env.PORT}/download/file/${result}`, res));
            res.status(200).json({ message: 'Download started', id: result });
        }
        else {
            progress.count -= 1;
            if (progress.count < 0) {
                progress.count = 0;
            }
            if (progress.count === 0) {
                progress.active = false;
            }
            res.status(200).json({ message: 'Nothing to download' });
        }
    })
        .catch(err => {
        res.status(400).json({ message: err });
    });
});
/**
 * @swagger
 *
 * /download/file/{fileId}:
 *   get:
 *     operationId: getDownloadFile
 *     description: download file by id
 *     produces:
 *       - application/json
 *     responses:
 *       500:
 *         description: error
 *       200:
 *         description: success
 */
local_microservice_1.api.get('/download/file/:fileId', (req, res) => {
    const trans = local_logger_1.startTransaction({
        message: 'file download',
        id: req.params.fileId,
        ...local_logger_1.localTokens(res),
    });
    if ('fileId' in req.params && !isNaN(parseInt(req.params.fileId))) {
        const fileId = parseInt(req.params.fileId);
        res.status(200).json({ message: 'initiated file download', id: fileId });
        index_1.getFile(client, fileId).then(file => {
            download_1.download(file)
                .then(name => {
                if (!name) {
                    file.state = 'ignore';
                }
                else {
                    file.state = 'downloaded';
                    file.file = name;
                }
                return index_1.updateFile(client, file).then(async () => {
                    await node_fetch_1.default(local_logger_1.addToken(`http://localhost:${process.env.PORT}/download/next`, res));
                    trans(true, {
                        message: 'download completed',
                        id: fileId,
                        filename: name,
                    });
                });
            })
                .catch(async (err) => {
                await index_1.failedFile(client, fileId).catch(err => {
                    local_logger_1.logError({ message: err });
                });
                trans(false, {
                    message: 'download failed',
                    id: fileId,
                    err,
                });
                local_logger_1.logError({ ...local_logger_1.localTokens(res), message: err });
                await node_fetch_1.default(local_logger_1.addToken(`http://localhost:${process.env.PORT}/download/next`, res));
            });
        });
    }
    else {
        res.status(400).json({ message: 'Valid id missing' });
    }
});
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map