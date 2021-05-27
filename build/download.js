"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.download = exports.directDownload = exports.endInterval = exports.nameFromFile = void 0;
const https = require("https");
const http = require("http");
const fs = require("fs");
const accept_1 = require("./accept");
const wfs_1 = require("./special/wfs");
const nas_1 = require("./special/nas");
const nameFromFile = (file) => {
    let name = file.url.substr(file.url.lastIndexOf('/') + 1);
    if (name.indexOf('?') > -1) {
        name = name.substr(0, name.indexOf('?'));
    }
    return `${file.id}--${name}`;
};
exports.nameFromFile = nameFromFile;
const endInterval = (interval) => {
    if (interval) {
        clearInterval(interval);
    }
};
exports.endInterval = endInterval;
const directDownload = (file, name) => {
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
        let interval = null;
        let requestPackage;
        if (file.url.indexOf('https') === 0) {
            requestPackage = https;
        }
        else {
            requestPackage = http;
        }
        requestPackage
            .get(file.url, response => {
            if (response.statusCode &&
                response.statusCode >= 200 &&
                response.statusCode < 300) {
                response.pipe(target);
                let fileSize = 0;
                interval = setInterval(() => {
                    console.log('check');
                    const stats = fs.statSync(targetLocation);
                    if (stats.size > fileSize) {
                        fileSize = stats.size;
                        console.log('continue', fileSize);
                    }
                    else {
                        console.log('abort');
                        target.end();
                        exports.endInterval(interval);
                        fs.unlink(targetLocation, () => {
                            reject('could not finish');
                        });
                    }
                }, 1000 * 60 * 5);
                target.on('finish', () => {
                    exports.endInterval(interval);
                    resolve(name);
                });
            }
            else if (response.statusCode &&
                response.statusCode === 302 &&
                response.headers.location) {
                // handle 302 redirects
                // TODO: if something redirects forever... this will never end... add max redirects
                file.url = response.headers.location;
                exports.endInterval(interval);
                resolve(exports.directDownload(file, name));
            }
            else {
                target.end();
                exports.endInterval(interval);
                fs.unlink(targetLocation, () => {
                    reject(response.statusCode);
                });
            }
        })
            .on('error', err => {
            target.end();
            exports.endInterval(interval);
            fs.unlink(targetLocation, () => {
                reject(err);
            });
        });
    });
};
exports.directDownload = directDownload;
const download = (file) => {
    if (accept_1.accept(file)) {
        if (file.format === 'wfs' &&
            (file.mimetype === 'false' || file.mimetype === 'application/xml')) {
            return wfs_1.wfs(file, exports.nameFromFile(file));
        }
        else if (file.format === 'nas' && file.mimetype === 'false') {
            return nas_1.nas(file, exports.nameFromFile(file));
        }
        return exports.directDownload(file, exports.nameFromFile(file));
    }
    else {
        return Promise.resolve(false);
    }
};
exports.download = download;
//# sourceMappingURL=download.js.map