import fetch from 'node-fetch';
import * as fs from 'fs';
import {XMLParser} from 'fast-xml-parser';
import {exec, ExecException} from 'child_process';
import type {File} from '../types';
import {logError} from '@opendatacloudservices/local-logger';
import {directDownload, tempName} from '../utils';

const capabilitiesLimit = 10 * 1024 * 1024;

export const isWfs = (url: string): Promise<boolean> => {
  const wfsUrl = prepareWfsUrl(url);

  // sometimes the wfs will not return getcapabilities, but the actual features
  // those features can be massive and parsing them will crash nodejs
  // if capabilities are bigger than 10MB we send it to the directDownload

  return fetch(wfsUrl, {method: 'HEAD'})
    .then(response => {
      if (
        response.ok &&
        response.status === 200 &&
        (!response.headers.get('content-length') ||
          Number(response.headers.get('content-length')) < capabilitiesLimit)
      ) {
        const targetName = tempName();
        return getCapabilities(wfsUrl, targetName, true)
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

export const removeRequests = (url: string): string => {
  const otherRequests = ['GetFeature', 'DescribeFeatureType', 'LockFeature'];
  otherRequests.forEach(r => {
    const search = 'request=' + r.toLowerCase();
    const oIndex = url.toLowerCase().indexOf(search);
    if (oIndex > -1) {
      if (url.substr(oIndex - 1, 1) === '?') {
        if (url.substr(oIndex + search.length, 1) === '&') {
          url = url.substr(0, oIndex) + url.substr(oIndex + search.length + 1);
        } else {
          url = url.substr(0, oIndex - 1) + url.substr(oIndex + search.length);
        }
      } else if (url.substr(oIndex - 1, 1) === '&') {
        url = url.substr(0, oIndex - 1) + url.substr(oIndex + search.length);
      } else {
        // better don't touch this...
      }
    }
  });
  return url;
};

export const prepareWfsUrl = (url: string): string => {
  url = url.split('&amp;').join('&');
  url = removeRequests(url);

  // check if GetCapabilities are already attached to url
  const urlComps = [
    ['service=', 'service=wfs'],
    ['version=', 'version=2.0.0'], // TODO: check return if 2.0.0 is not supported
    ['request=getcapabilities', 'request=GetCapabilities'],
  ];

  urlComps.forEach(comp => {
    if (url.toLowerCase().indexOf(comp[0]) === -1) {
      if (url.indexOf('?') === -1) {
        url += '?';
      } else {
        url += '&';
      }
      url += comp[1];
    }
  });

  return url;
};

export const getCapabilities = (
  url: string,
  target: string,
  deleteAfter = false
): Promise<null | {
  [index: string]: {
    [index: string]: {[index: string]: {Name?: string} | {Name?: string}[]};
  };
}> => {
  return directDownload(url, target).then(() => {
    if (fs.existsSync(target)) {
      const stats = fs.statSync(target);
      if (stats.size < capabilitiesLimit) {
        const fileContents = fs.readFileSync(target, 'utf8');
        const parser = new XMLParser({
          ignoreAttributes: false,
          removeNSPrefix: true,
        });
        const json = parser.parse(fileContents, false);
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

export const wfs = (
  file: File,
  fileName: string
): Promise<{source: string; files: string[]; layers: string[]}> => {
  let fileList: string[] = [];
  const folder = process.env.DOWNLOAD_LOCATION + fileName;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  const url = prepareWfsUrl(file.url);

  return getCapabilities(url, folder + '/GetCapabilities.json')
    .then(async json => {
      if (!json || !('WFS_Capabilities' in json)) {
        throw 'Malformed GetCapabilities';
      }

      const featureTypeList: {
        FeatureType?: {Name?: string} | {Name?: string}[];
      } = json['WFS_Capabilities']['FeatureTypeList'];

      let features: string[] = [];

      if (Array.isArray(featureTypeList['FeatureType'])) {
        for (let i = 0; i < featureTypeList['FeatureType'].length; i += 1) {
          features.push(featureTypeList['FeatureType'][i]['Name'] || '');
        }
      } else if (featureTypeList['FeatureType']) {
        features = [featureTypeList['FeatureType']['Name'] || ''];
      }

      fileList = features.map(
        (feature, fi) => `${fileName}/layer_${fi}_${feature}.gpkg`
      );

      const results: (null | [string, string])[] = [];

      // Some WFS endpoints have tons of layers, requesting them all at once potentially crashes the endpoint

      for (let fi = 0; fi < features.length; fi += 1) {
        const feature = features[fi];
        const result: null | [string, string] = await new Promise(resolve => {
          // TODO: check for failed calls e.g. false url download.id = 530203
          // TODO: interval to check if file size increases (big time interval)
          ogr2ogr(
            folder,
            fi,
            feature,
            url,
            err => {
              // there is a rare problem when the actual layers prefix is dropped on the server
              // on the contrary this alternative approach can also lead to corrupted files which are basically empty
              // those get picked up and sorted out by the spatial classification process
              // another problem is layers without geometries or much else (which sadly do exist a lot, thank you)
              removeOgr2ogr(folder, fi, feature);
              logError({...err, ogrLevel: 1});
              ogr2ogr(
                folder,
                fi,
                feature.split(':')[1],
                url,
                err => {
                  removeOgr2ogr(folder, fi, feature.split(':')[1]);
                  logError({...err, ogrLevel: 2});
                  resolve(null);
                },
                () => {
                  resolve([fileList[fi], feature.split(':')[1]]);
                }
              );
            },
            () => {
              resolve([fileList[fi], feature]);
            }
          );
        });
        results.push(result);
      }
      return results;
    })
    .then(results => {
      // check which layers actually successfully downloaded
      const actualFileList: string[] = [];
      const actualLayerList: string[] = [];
      results.forEach(r => {
        if (r) {
          actualFileList.push(r[0]);
          actualLayerList.push(r[1]);
        }
      });
      return {source: fileName, files: actualFileList, layers: actualLayerList};
    });
};

export const removeOgr2ogr = (folder: string, fi: number, feature: string) => {
  const file = `${folder}/layer_${fi}_${feature}.gpkg`;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};

export const ogr2ogrUrlPrepare = (url: string): string => {
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
      } else {
        cleanUrl += '&';
      }
      cleanUrl += el;
    }
  });
  return cleanUrl;
};

export const ogr2ogr = (
  folder: string,
  fi: number,
  feature: string,
  url: string,
  error: (err: ExecException) => void,
  callback: (stdout: string, stderr: string) => void
): void => {
  exec(
    `ogr2ogr \
    -f gpkg ${folder}/layer_${fi}_${feature}.gpkg \
    WFS:"${ogr2ogrUrlPrepare(url)}" \
    ${feature} \
    --config OGR_WFS_PAGE_SIZE 1000`,
    (err, stdout, stderr) => {
      if (err) {
        error(err);
      }
      callback(stdout, stderr);
    }
  );
};
