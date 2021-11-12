"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ogr2ogr = exports.ogr2ogrUrlPrepare = exports.removeOgr2ogr = exports.wfs = exports.getCapabilities = exports.prepareWfsUrl = exports.removeRequests = exports.isWfs = void 0;
const node_fetch_1 = require("node-fetch");
const fs = require("fs");
const parser = require("fast-xml-parser");
const child_process_1 = require("child_process");
const build_1 = require("local-logger/build");
const utils_1 = require("../utils");
const capabilitiesLimit = 10 * 1024 * 1024;
const isWfs = (url) => {
    const wfsUrl = (0, exports.prepareWfsUrl)(url);
    // sometimes the wfs will not return getcapabilities, but the actual features
    // those features can be massive and parsing them will crash nodejs
    // if capabilities are bigger than 10MB we send it to the directDownload
    return (0, node_fetch_1.default)(wfsUrl, { method: 'HEAD' })
        .then(response => {
        if (response.ok &&
            response.status === 200 &&
            (!response.headers.get('content-length') ||
                Number(response.headers.get('content-length')) < capabilitiesLimit)) {
            const targetName = (0, utils_1.tempName)();
            return (0, exports.getCapabilities)(wfsUrl, targetName, true)
                .then(json => {
                if (json && 'WFS_Capabilities' in json) {
                    return true;
                }
                return false;
            })
                .catch(() => {
                return false;
            });
        }
        return false;
    })
        .catch(() => {
        return false;
    });
};
exports.isWfs = isWfs;
const removeRequests = (url) => {
    const otherRequests = ['GetFeature', 'DescribeFeatureType', 'LockFeature'];
    otherRequests.forEach(r => {
        const search = 'request=' + r.toLowerCase();
        const oIndex = url.toLowerCase().indexOf(search);
        if (oIndex > -1) {
            if (url.substr(oIndex - 1, 1) === '?') {
                if (url.substr(oIndex + search.length, 1) === '&') {
                    url = url.substr(0, oIndex) + url.substr(oIndex + search.length + 1);
                }
                else {
                    url = url.substr(0, oIndex - 1) + url.substr(oIndex + search.length);
                }
            }
            else if (url.substr(oIndex - 1, 1) === '&') {
                url = url.substr(0, oIndex - 1) + url.substr(oIndex + search.length);
            }
            else {
                // better don't touch this...
            }
        }
    });
    return url;
};
exports.removeRequests = removeRequests;
const prepareWfsUrl = (url) => {
    url = url.split('&amp;').join('&');
    url = (0, exports.removeRequests)(url);
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
    return url;
};
exports.prepareWfsUrl = prepareWfsUrl;
const getCapabilities = (url, target, deleteAfter = false) => {
    return (0, utils_1.directDownload)(url, target).then(() => {
        if (fs.existsSync(target)) {
            const stats = fs.statSync(target);
            if (stats.size < capabilitiesLimit) {
                const fileContents = fs.readFileSync(target, 'utf8');
                const json = parser.parse(fileContents, { ignoreNameSpace: true }, false);
                if (deleteAfter) {
                    fs.unlinkSync(target);
                }
                return json;
            }
            fs.unlinkSync(target);
        }
        return null;
    });
};
exports.getCapabilities = getCapabilities;
const wfs = (file, fileName) => {
    let fileList = [];
    const folder = process.env.DOWNLOAD_LOCATION + fileName;
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    const url = (0, exports.prepareWfsUrl)(file.url);
    // 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_wfs_alkis';
    // 'https://geo.sv.rostock.de/geodienste/bplaene/wfs';
    return (0, exports.getCapabilities)(url, folder + '/GetCapabilities.json')
        .then(async (json) => {
        if (!json || !('WFS_Capabilities' in json)) {
            throw 'Malformed GetCapabilities';
        }
        const featureTypeList = json['WFS_Capabilities']['FeatureTypeList'];
        let features = [];
        if (Array.isArray(featureTypeList['FeatureType'])) {
            for (let i = 0; i < featureTypeList['FeatureType'].length; i += 1) {
                features.push(featureTypeList['FeatureType'][i]['Name'] || '');
            }
        }
        else if (featureTypeList['FeatureType']) {
            features = [featureTypeList['FeatureType']['Name'] || ''];
        }
        fileList = features.map((feature, fi) => `${fileName}/layer_${fi}_${feature}.gpkg`);
        const results = [];
        // Some WFS endpoints have tons of layers, requesting them all at once potentially crashes the endpoint
        for (let fi = 0; fi < features.length; fi += 1) {
            const feature = features[fi];
            const result = await new Promise(resolve => {
                // TODO: check for failed calls e.g. false url download.id = 530203
                // TODO: interval to check if file size increases (big time interval)
                (0, exports.ogr2ogr)(folder, fi, feature, url, err => {
                    // there is a rare problem when the actual layers prefix is dropped on the server
                    // on the contrary this alternative approach can also lead to corrupted files which are basically empty
                    // those get picked up and sorted out by the spatial classification process
                    // another problem is layers without geometries or much else (which sadly do exist a lot, thank you)
                    (0, exports.removeOgr2ogr)(folder, fi, feature);
                    (0, build_1.logError)({ ...err, ogrLevel: 1 });
                    (0, exports.ogr2ogr)(folder, fi, feature.split(':')[1], url, err => {
                        (0, exports.removeOgr2ogr)(folder, fi, feature.split(':')[1]);
                        (0, build_1.logError)({ ...err, ogrLevel: 2 });
                        resolve(null);
                    }, () => {
                        resolve([fileList[fi], feature.split(':')[1]]);
                    });
                }, () => {
                    resolve([fileList[fi], feature]);
                });
            });
            results.push(result);
        }
        return results;
    })
        .then(results => {
        // check which layers actually successfully downloaded
        const actualFileList = [];
        const actualLayerList = [];
        results.forEach(r => {
            if (r) {
                actualFileList.push(r[0]);
                actualLayerList.push(r[1]);
            }
        });
        return { source: fileName, files: actualFileList, layers: actualLayerList };
    });
};
exports.wfs = wfs;
const removeOgr2ogr = (folder, fi, feature) => {
    const file = `${folder}/layer_${fi}_${feature}.gpkg`;
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
};
exports.removeOgr2ogr = removeOgr2ogr;
const ogr2ogrUrlPrepare = (url) => {
    const ignore = ['version', 'request', 'service'];
    url = url.split('&amp;').join('&');
    const base = url.split('?');
    if (base.length === 1) {
        // no params
        return url;
    }
    let cleanUrl = base[0];
    let urlExtended = false;
    base[1].split('&').forEach(el => {
        const els = el.split('=');
        if (!ignore.includes(els[0].toLowerCase())) {
            if (!urlExtended) {
                cleanUrl += '?';
                urlExtended = true;
            }
            else {
                cleanUrl += '&';
            }
            cleanUrl += el;
        }
    });
    return cleanUrl;
};
exports.ogr2ogrUrlPrepare = ogr2ogrUrlPrepare;
const ogr2ogr = (folder, fi, feature, url, error, callback) => {
    (0, child_process_1.exec)(`ogr2ogr \
    -f gpkg ${folder}/layer_${fi}_${feature}.gpkg \
    WFS:"${(0, exports.ogr2ogrUrlPrepare)(url)}" \
    ${feature} \
    --config OGR_WFS_PAGE_SIZE 1000`, (err, stdout, stderr) => {
        if (err) {
            error(err);
        }
        callback(stdout, stderr);
    });
};
exports.ogr2ogr = ogr2ogr;
//# sourceMappingURL=wfs.js.map