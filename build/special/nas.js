"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nas = void 0;
const node_fetch_1 = require("node-fetch");
const fs_1 = require("fs");
const cheerio = require("cheerio");
const url = require("url");
const download_1 = require("../download");
const zipExtensions = ['zip', 'zipx', 'tar', '7z', 'gz'];
const nas = (file, fileName) => {
    const folder = process.env.DOWNLOAD_LOCATION + fileName;
    if (!fs_1.existsSync(folder)) {
        fs_1.mkdirSync(folder);
    }
    const fileURL = new url.URL(file.url);
    return node_fetch_1.default(file.url)
        .then(response => {
        if (response.ok && response.status === 200) {
            return response;
        }
        else {
            throw response.status;
        }
    })
        .then(response => response.text())
        .then(html => {
        fs_1.writeFileSync('./tmp/nas.txt', html, 'utf8');
        const files = [];
        const $ = cheerio.load(html);
        const links = $('a');
        if (links && links.length > 0) {
            for (let i = 0; i < links.length; i += 1) {
                let link = $(links[i]).attr('href');
                let isZip = false;
                zipExtensions.forEach(ext => {
                    if (link && link.indexOf('.' + ext) > -1) {
                        isZip = true;
                    }
                });
                if (link && isZip) {
                    link = link.trim();
                    // transform relative to absolute links
                    if (link.substr(0, 5) === '//www') {
                        link = 'https:' + link;
                    }
                    else if (link.substr(0, 1) === '/') {
                        link = fileURL.protocol + '//' + fileURL.host + link;
                    }
                    else if (link.substr(0, 4) !== 'http') {
                        link =
                            file.url +
                                (file.url.substr(file.url.length - 1) === '/' ? '' : '/') +
                                link;
                    }
                    files.push(link);
                }
            }
        }
        // Sometimes those downloads can take hours to finish because of Gigs of data
        // So we keep this running in the background and respond...
        // TODO: somehow keep track of concurrent downloads
        Promise.all(files.map((downloadFile, fi) => {
            return download_1.directDownload({
                ...file,
                url: downloadFile,
            }, process.env.DOWNLOAD_LOCATION + fileName + '/' + fi + '_' + file);
        }));
        return fileName;
    });
};
exports.nas = nas;
//# sourceMappingURL=nas.js.map