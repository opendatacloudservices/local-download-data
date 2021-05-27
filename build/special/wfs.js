"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wfs = void 0;
const node_fetch_1 = require("node-fetch");
const fs_1 = require("fs");
const parser = require("fast-xml-parser");
const child_process_1 = require("child_process");
const wfs = (file, fileName) => {
    const folder = process.env.DOWNLOAD_LOCATION + fileName;
    if (!fs_1.existsSync(folder)) {
        fs_1.mkdirSync(folder);
    }
    let url = file.url;
    // 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_wfs_alkis';
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
    return node_fetch_1.default(url)
        .then(response => {
        if (response.ok && response.status === 200) {
            return response;
        }
        else {
            throw response.status;
        }
    })
        .then(response => {
        return response.text();
    })
        .then(body => {
        const json = parser.parse(body, {}, false);
        fs_1.writeFileSync(folder + '/GetCapabilities.json', JSON.stringify(json, null, 2), 'utf8');
        if (!('wfs:WFS_Capabilities' in json)) {
            throw 'Malformed GetCapabilities';
        }
        const featureTypeList = 'wfs:FeatureTypeList' in json['wfs:WFS_Capabilities']
            ? json['wfs:WFS_Capabilities']['wfs:FeatureTypeList']
            : json['wfs:WFS_Capabilities']['FeatureTypeList'];
        let features = [];
        if (!('wfs:FeatureType' in featureTypeList)) {
            featureTypeList['wfs:FeatureType'] = featureTypeList['FeatureType'];
        }
        if (Array.isArray(featureTypeList['wfs:FeatureType'])) {
            for (let i = 0; i < featureTypeList['wfs:FeatureType'].length; i += 1) {
                if (featureTypeList['wfs:FeatureType'][i]['wfs:Name']) {
                    features.push(featureTypeList['wfs:FeatureType'][i]['wfs:Name'] || '');
                }
                else if (featureTypeList['wfs:FeatureType'][i]['Name']) {
                    features.push(featureTypeList['wfs:FeatureType'][i]['Name'] || '');
                }
            }
        }
        else if (featureTypeList['wfs:FeatureType']) {
            if (featureTypeList['wfs:FeatureType']['wfs:Name']) {
                features = [featureTypeList['wfs:FeatureType']['wfs:Name']];
            }
            else if (featureTypeList['wfs:FeatureType']['Name']) {
                features = [featureTypeList['wfs:FeatureType']['Name']];
            }
        }
        return Promise.all(features.map((feature, fi) => {
            return new Promise((resolve, reject) => {
                // TODO: check for failed calls e.g. false url download.id = 530203
                child_process_1.exec(`ogr2ogr \
              -f gpkg ${folder}/layer_${fi}_${feature}.gpkg \
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
    })
        .then(() => {
        return fileName;
    });
};
exports.wfs = wfs;
//# sourceMappingURL=wfs.js.map