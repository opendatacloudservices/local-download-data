"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accept = void 0;
const local_logger_1 = require("local-logger");
// for now we only accept machine readable data
// acceptedFormat is combined with acceptedMimetype (see below)
const acceptedFormat = [
    'csv',
    'xlsx',
    'html',
    'zip',
    'xml',
    'json',
    'gml',
    'view',
    'karte',
    'webanwendung',
    'shp',
    'xplangml',
    'wfs',
    'geojson',
    'kml',
    'atom',
    'txt',
    'kmz',
    'ascii',
    'xml/soap',
    'application/ld+json',
    'gpx',
    'nas',
    'rdf',
    'geodatabase',
    'rss',
    'gzip',
    'rar',
    'citygml',
    'dxf',
    'gtfs',
    'tcx',
    'filegeodatabase',
    'gpkg',
    'tsv',
    '7z',
    'json-ld',
];
const acceptedMimetype = [
    'text/csv',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/xml',
    'application/vnd.ms-excel',
    'text/html',
    'application/json',
    'application/vnd.google-earth.kml+xml',
    'application/geo+json',
    'application/gml+xml',
    'text/plain',
    'application/x-httpd-php',
    'application/vnd.google-earth.kmz',
    'application/rdf+xml',
    'application/gzip',
    'application/gpx+xml',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/rss+xml',
    'text/sgml',
    'text/tab-separated-values',
    'text/yaml',
    'application/ld+json',
];
const accept = (file) => {
    let accepted = false;
    if (acceptedFormat.includes(file.format)) {
        accepted = true;
    }
    else if (acceptedMimetype.includes(file.mimetype)) {
        accepted = true;
    }
    else if (file.mimetype === 'false') {
        local_logger_1.logInfo({
            type: 'unknown fileformat',
            message: file,
        });
    }
    return accepted;
};
exports.accept = accept;
//# sourceMappingURL=accept.js.map