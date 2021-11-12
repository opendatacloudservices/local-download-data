import * as fs from 'fs';
import {v4 as uuid} from 'uuid';
import * as https from 'https';
import * as http from 'http';

export const endInterval = (interval: null | NodeJS.Timeout): void => {
  if (interval) {
    clearInterval(interval);
  }
};

const tempFolder = 'tmp';

export const tempName = (): string => {
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder);
  }

  const tempName = uuid();
  const targetLocation = tempFolder + '/' + tempName;

  return targetLocation;
};

const maxRedirects = 20;

export const directDownload = (
  url: string,
  targetLocation: string,
  redirect = 0
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (redirect > maxRedirects) {
      reject('too many redirects');
    }

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
    if (url.indexOf('https') === 0) {
      requestPackage = https;
    } else {
      requestPackage = http;
    }
    requestPackage
      .get(url, response => {
        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          response.pipe(target);
          let fileSize = 0;
          let existTimer = 0;
          if (interval) {
            endInterval(interval);
          }
          interval = setInterval(() => {
            const exists = fs.existsSync(targetLocation);
            if (exists) {
              const stats = fs.statSync(targetLocation);
              if (stats.size > fileSize) {
                fileSize = stats.size;
              } else {
                target.end();
                endInterval(interval);
                fs.unlink(targetLocation, () => {
                  reject('could not finish');
                });
              }
            } else {
              existTimer += 1;
              if (existTimer > 5) {
                target.end();
                endInterval(interval);
                fs.unlink(targetLocation, () => {
                  reject('could not finish or create');
                });
              }
            }
          }, 1000 * 60 * 5);

          target.on('finish', () => {
            endInterval(interval);
            resolve();
          });
        } else if (
          response.statusCode &&
          response.statusCode === 302 &&
          response.headers.location
        ) {
          // handle 302 redirects
          url = response.headers.location;
          endInterval(interval);
          resolve(directDownload(url, targetLocation, redirect + 1));
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
