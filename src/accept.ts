import type {File} from './types';
import {logInfo} from 'local-logger';

// for now we only accept machine readable data
// acceptedFormat is combined with acceptedMimetype (see below)
const acceptedFormat = [
  '7z',
  'application/ld+json',
  'ascii',
  'atom',
  'citygml',
  'csv',
  'download',
  'dxf',
  'filegeodatabase',
  'geodatabase',
  'geojson',
  'gml',
  'gpkg',
  'gpx',
  'gtfs',
  'gzip', // unpack
  // 'html',
  'json-ld',
  'json',
  'karte',
  'kml',
  'kmz',
  'nas', // special
  // 'oracle',
  'postgres',
  'rar', //unpack
  'rdf',
  'rss',
  'shp',
  'tcx',
  'tsv',
  'tsv',
  'txt',
  // 'view',
  // 'webanwendung',
  'wfs', // special
  'xlsx',
  'xml',
  'xml/soap',
  'xplangml',
  'zip', // unpack
];

const bannedFormats = ['wms', 'pdf', 'jpeg', 'png', 'geotiff'];

const acceptedMimetype = [
  'application/geo+json',
  'application/gml+xml',
  'application/gpx+xml',
  'application/gzip',
  'application/json',
  'application/ld+json',
  'application/rdf+xml',
  'application/rss+xml',
  'application/vnd.google-earth.kml+xml',
  'application/vnd.google-earth.kmz',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.rar',
  'application/x-7z-compressed',
  // 'application/x-httpd-php',
  'application/xml',
  'application/zip',
  'text/csv',
  // 'text/html', // html makes no sense at this time
  'text/plain',
  'text/sgml',
  'text/tab-separated-values',
  'text/yaml',
];

export const accept = (file: File): boolean => {
  let accepted = false;
  if (
    file.format &&
    acceptedFormat.includes(file.format.toLowerCase()) &&
    !bannedFormats.includes(file.format.toLowerCase())
  ) {
    accepted = true;
  } else if (
    file.mimetype &&
    acceptedMimetype.includes(file.mimetype.toLowerCase()) &&
    !bannedFormats.includes(file.format.toLowerCase())
  ) {
    accepted = true;
  } else if (file.mimetype && file.mimetype === 'false') {
    logInfo({
      type: 'unknown fileformat',
      message: file,
    });
  }
  return accepted;
};
