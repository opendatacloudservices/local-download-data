"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const fs_1 = require("fs");
const parser = require("fast-xml-parser");
const child_process_1 = require("child_process");
let url = 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_wfs_alkis';
// 'https://geo.sv.rostock.de/geodienste/bplaene/wfs';
// check if GetCapabilities are already attached to url
const urlComps = [
    ['service=', 'service=wfs'],
    ['version=', 'version=2.0.0'],
    ['request=getcapabilities', 'request=GetCapabilities'],
];
urlComps.forEach(comp => {
    if (url.toLowerCase().indexOf(comp[0]) === -1) {
        if (url.indexOf('?') === -1) {
            url += '?';
        }
        else {
            url += '&';
        }
        url += comp[1];
    }
});
node_fetch_1.default(url)
    .then(response => response.text())
    .then(body => {
    const json = parser.parse(body, {}, false);
    fs_1.writeFileSync('./tmp/GetCapabilities.json', JSON.stringify(json, null, 2), 'utf8');
    const featureTypeList = json['wfs:WFS_Capabilities']['wfs:FeatureTypeList'];
    let features = [];
    if (Array.isArray(featureTypeList['wfs:FeatureType'])) {
        features = featureTypeList['wfs:FeatureType'].map(feature => feature['wfs:Name']);
    }
    else {
        features = [featureTypeList['wfs:FeatureType']['wfs:Name']];
    }
    return Promise.all(features.map((feature, fi) => {
        return new Promise((resolve, reject) => {
            child_process_1.exec(`ogr2ogr \
            -f gpkg tmp/layer_${fi}_${feature}.gpkg \
            WFS:${url.substr(0, url.indexOf('?'))} \
            ${feature} \
            --config OGR_WFS_PAGE_SIZE 1000`, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                }
                resolve({ stdout, stderr });
            });
        });
    }));
    // get layers
    // create folder
    // download each layer into folder
})
    .then(() => {
    console.log('all done');
});
//# sourceMappingURL=wfs.js.map