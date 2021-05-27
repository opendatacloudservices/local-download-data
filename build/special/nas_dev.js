"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const fs_1 = require("fs");
const cheerio = require("cheerio");
const url = require("url");
const fileUrl = 'https://gisdata.krzn.de/files/opendatagis/Kreis_Wesel/Aufnahmepunkte/';
// https://www.opengeodata.nrw.de/produkte/geobasis/lm/basis-dlm/
const fileURL = new url.URL(fileUrl);
const zipExtensions = ['zip', 'zipx', 'tar', '7z', 'gz'];
node_fetch_1.default(fileUrl)
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
                    link = fileURL.protocol + fileURL.host + link;
                }
                files.push(link);
            }
        }
    }
    console.log(files);
});
//# sourceMappingURL=nas_dev.js.map