import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';
import fetch from 'node-fetch';
import {
  failedFile,
  getFile,
  updateFile,
  getNextDownload,
} from './postgres/index';
import * as pm2 from 'local-pm2-config';
import {
  download,
  resetMissingDownloads,
  resetDownloads,
  removeEmpty,
} from './download';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll} from 'local-microservice';

import {addToken, startTransaction, localTokens, logError} from 'local-logger';

// number of parallel processes
let processCount = 1;
pm2.apps.forEach(app => {
  if (app.name === 'local-download-data') {
    processCount = app.max;
  }
});
const progress = {
  active: false,
  count: 0,
};

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client
  .connect()
  .then(() => resetMissingDownloads(client))
  .then(() => resetDownloads(client))
  .then(() => removeEmpty(client))
  .then(() => console.log('ready'))
  .catch(err => {
    logError({message: err});
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
api.get('/download/all', async (req, res) => {
  if (!progress.active) {
    progress.active = true;
    const parallelCount = 3 * processCount;
    const fetchs = [];
    for (let i = 0; i < parallelCount; i += 1) {
      progress.count += 1;
      fetchs.push(
        fetch(
          addToken(`http://localhost:${process.env.PORT}/download/next`, res)
        )
      );
    }
    res.status(200).json({message: 'Download initiated'});
    await Promise.all(fetchs);
  } else {
    res.status(200).json({message: 'Download already in progress'});
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
api.get('/download/next', (req, res) => {
  getNextDownload(client)
    .then(async result => {
      if (result) {
        if (!progress.active) {
          progress.active = true;
        }
        await fetch(
          addToken(
            `http://localhost:${process.env.PORT}/download/file/${result}`,
            res
          )
        );
        res.status(200).json({message: 'Download started', id: result});
      } else {
        progress.count -= 1;
        if (progress.count < 0) {
          progress.count = 0;
        }
        if (progress.count === 0) {
          progress.active = false;
        }
        res.status(200).json({message: 'Nothing to download'});
      }
    })
    .catch(err => {
      res.status(400).json({message: err});
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
api.get('/download/file/:fileId', (req, res) => {
  const trans = startTransaction({
    message: 'file download',
    id: req.params.fileId,
    ...localTokens(res),
  });
  if ('fileId' in req.params && !isNaN(parseInt(req.params.fileId))) {
    const fileId = parseInt(req.params.fileId);
    res.status(200).json({message: 'initiated file download', id: fileId});

    getFile(client, fileId).then(file => {
      download(file)
        .then(name => {
          if (!name) {
            file.state = 'ignore';
          } else {
            file.state = 'downloaded';
            file.file = name.source;
          }
          return updateFile(
            client,
            file,
            name ? name.files : [],
            name && name.layers ? name.layers : []
          ).then(async () => {
            await fetch(
              addToken(
                `http://localhost:${process.env.PORT}/download/next`,
                res
              )
            );
            trans(true, {
              message: 'download completed',
              id: fileId,
              filename: name ? name.source : '',
            });
          });
        })
        .catch(async err => {
          await failedFile(client, fileId).catch(err => {
            logError({message: err});
          });
          trans(false, {
            message: 'download failed',
            id: fileId,
            err,
          });
          logError({...localTokens(res), message: err});
          await fetch(
            addToken(`http://localhost:${process.env.PORT}/download/next`, res)
          );
        });
    });
  } else {
    res.status(400).json({message: 'Valid id missing'});
  }
});

catchAll();
