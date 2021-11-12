"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nas = void 0;
const cheerio = require("cheerio");
const url = require("url");
const fs = require("fs");
const utils_1 = require("../utils");
const zipExtensions = ['zip', 'zipx', 'tar', '7z', 'gz'];
const capabilitiesLimit = 10 * 1024 * 1024;
const nas = (file, fileName) => {
    const tempTarget = (0, utils_1.tempName)();
    return (0, utils_1.directDownload)(file.url, tempTarget).then(async () => {
        if (fs.existsSync(tempTarget)) {
            const stats = fs.statSync(tempTarget);
            if (stats.size < capabilitiesLimit) {
                const files = [];
                try {
                    const fileURL = new url.URL(file.url);
                    const html = fs.readFileSync(tempTarget, 'utf8');
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
                }
                catch (err) {
                    // this is probably not an html/xml in the first place, keep it for later analysis
                }
                if (files.length > 0) {
                    fs.unlinkSync(tempTarget);
                    const folder = process.env.DOWNLOAD_LOCATION + fileName;
                    if (!fs.existsSync(folder)) {
                        fs.mkdirSync(folder);
                    }
                    const filesList = [];
                    // Sometimes those downloads can take hours to finish because of Gigs of data
                    // So we keep this running in the background and respond...
                    for (let f = 0; f < files.length; f += 1) {
                        const file = fileName + '/' + f + '_' + files[f];
                        let success = false;
                        try {
                            await (0, utils_1.directDownload)(files[f], process.env.DOWNLOAD_LOCATION + file);
                            success = true;
                        }
                        catch (err) {
                            success = true;
                        }
                        if (success) {
                            filesList.push(file);
                        }
                    }
                    if (filesList.length === 0) {
                        fs.unlinkSync(tempTarget);
                        return null;
                    }
                    else {
                        return { source: fileName, files: filesList };
                    }
                }
            }
            fs.copyFileSync(tempTarget, process.env.DOWNLOAD_LOCATION + fileName);
            fs.unlinkSync(tempTarget);
            return { source: fileName, files: [fileName] };
            // sometimes nas referes directly to a zip file, therefore we don't delete the file if its too big
        }
        return null;
    });
};
exports.nas = nas;
//# sourceMappingURL=nas.js.map