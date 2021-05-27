import {File} from './types';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import {accept} from './accept';
import {wfs} from './special/wfs';
import {nas} from './special/nas';

export const nameFromFile = (file: File): string => {
  let name = file.url.substr(file.url.lastIndexOf('/') + 1);
  if (name.indexOf('?') > -1) {
    name = name.substr(0, name.indexOf('?'));
  }
  return `${file.id}--${name}`;
};

export const endInterval = (interval: null | NodeJS.Timeout): void => {
  if (interval) {
    clearInterval(interval);
  }
};

export const directDownload = (file: File, name: string): Promise<string> => {
  const targetLocation = process.env.DOWNLOAD_LOCATION + name;
  return new Promise((resolve, reject) => {
    const target = fs.createWriteStream(targetLocation);
    target.on('error', err => {
      fs.unlink(targetLocation, () => {
        reject(err);
      });
    });

    // Some servers respond extremely slow and fail, but never properly fail
    // This interval checks every 5 minutes, if the file size has increased
    // If nothing happens for 5 minutes, download is considered failed
    let interval: null | NodeJS.Timeout = null;

    let requestPackage;
    if (file.url.indexOf('https') === 0) {
      requestPackage = https;
    } else {
      requestPackage = http;
    }
    requestPackage
      .get(file.url, response => {
        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          response.pipe(target);
          let fileSize = 0;
          interval = setInterval(() => {
            console.log('check');
            const stats = fs.statSync(targetLocation);
            if (stats.size > fileSize) {
              fileSize = stats.size;
              console.log('continue', fileSize);
            } else {
              console.log('abort');
              target.end();
              endInterval(interval);
              fs.unlink(targetLocation, () => {
                reject('could not finish');
              });
            }
          }, 1000 * 60 * 5);

          target.on('finish', () => {
            endInterval(interval);
            resolve(name);
          });
        } else if (
          response.statusCode &&
          response.statusCode === 302 &&
          response.headers.location
        ) {
          // handle 302 redirects
          // TODO: if something redirects forever... this will never end... add max redirects
          file.url = response.headers.location;
          endInterval(interval);
          resolve(directDownload(file, name));
        } else {
          target.end();
          endInterval(interval);
          fs.unlink(targetLocation, () => {
            reject(response.statusCode);
          });
        }
      })
      .on('error', err => {
        target.end();
        endInterval(interval);
        fs.unlink(targetLocation, () => {
          reject(err);
        });
      });
  });
};

export const download = (file: File): Promise<string | false> => {
  if (accept(file)) {
    if (
      file.format === 'wfs' &&
      (file.mimetype === 'false' || file.mimetype === 'application/xml')
    ) {
      return wfs(file, nameFromFile(file));
    } else if (file.format === 'nas' && file.mimetype === 'false') {
      return nas(file, nameFromFile(file));
    }
    return directDownload(file, nameFromFile(file));
  } else {
    return Promise.resolve(false);
  }
};
