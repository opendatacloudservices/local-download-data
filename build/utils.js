"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.directDownload = exports.tempName = exports.endInterval = void 0;
const fs = require("fs");
const uuid_1 = require("uuid");
const https = require("https");
const http = require("http");
const endInterval = (interval) => {
    if (interval) {
        clearInterval(interval);
    }
};
exports.endInterval = endInterval;
const tempFolder = 'tmp';
const tempName = () => {
    if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder);
    }
    const tempName = (0, uuid_1.v4)();
    const targetLocation = tempFolder + '/' + tempName;
    return targetLocation;
};
exports.tempName = tempName;
const maxRedirects = 20;
const directDownload = (url, targetLocation, redirect = 0) => {
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
        let interval = null;
        let requestPackage;
        if (url.indexOf('https') === 0) {
            requestPackage = https;
        }
        else {
            requestPackage = http;
        }
        requestPackage
            .get(url, response => {
            if (response.statusCode &&
                response.statusCode >= 200 &&
                response.statusCode < 300) {
                response.pipe(target);
                let fileSize = 0;
                let existTimer = 0;
                if (interval) {
                    (0, exports.endInterval)(interval);
                }
                interval = setInterval(() => {
                    const exists = fs.existsSync(targetLocation);
                    if (exists) {
                        const stats = fs.statSync(targetLocation);
                        if (stats.size > fileSize) {
                            fileSize = stats.size;
                        }
                        else {
                            target.end();
                            (0, exports.endInterval)(interval);
                            fs.unlink(targetLocation, () => {
                                reject('could not finish');
                            });
                        }
                    }
                    else {
                        existTimer += 1;
                        if (existTimer > 5) {
                            target.end();
                            (0, exports.endInterval)(interval);
                            fs.unlink(targetLocation, () => {
                                reject('could not finish or create');
                            });
                        }
                    }
                }, 1000 * 60 * 5);
                target.on('finish', () => {
                    (0, exports.endInterval)(interval);
                    resolve();
                });
            }
            else if (response.statusCode &&
                response.statusCode === 302 &&
                response.headers.location) {
                // handle 302 redirects
                url = response.headers.location;
                (0, exports.endInterval)(interval);
                resolve((0, exports.directDownload)(url, targetLocation, redirect + 1));
            }
            else {
                target.end();
                (0, exports.endInterval)(interval);
                fs.unlink(targetLocation, () => {
                    reject(response.statusCode);
                });
            }
        })
            .on('error', err => {
            target.end();
            (0, exports.endInterval)(interval);
            fs.unlink(targetLocation, () => {
                reject(err);
            });
        });
    });
};
exports.directDownload = directDownload;
//# sourceMappingURL=utils.js.map