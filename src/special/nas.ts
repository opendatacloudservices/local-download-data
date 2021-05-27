import type {File} from '../types';
import fetch from 'node-fetch';
import {writeFileSync, mkdirSync, existsSync} from 'fs';
import * as cheerio from 'cheerio';
import * as url from 'url';
import {directDownload} from '../download';

const zipExtensions = ['zip', 'zipx', 'tar', '7z', 'gz'];

export const nas = (file: File, fileName: string): Promise<string> => {
  const folder = process.env.DOWNLOAD_LOCATION + fileName;
  if (!existsSync(folder)) {
    mkdirSync(folder);
  }

  const fileURL = new url.URL(file.url);

  return fetch(file.url)
    .then(response => {
      if (response.ok && response.status === 200) {
        return response;
      } else {
        throw response.status;
      }
    })
    .then(response => response.text())
    .then(html => {
      writeFileSync('./tmp/nas.txt', html, 'utf8');
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
            } else if (link.substr(0, 1) === '/') {
              link = fileURL.protocol + '//' + fileURL.host + link;
            } else if (link.substr(0, 4) !== 'http') {
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
      Promise.all(
        files.map((downloadFile, fi) => {
          return directDownload(
            {
              ...file,
              url: downloadFile,
            },
            process.env.DOWNLOAD_LOCATION + fileName + '/' + fi + '_' + file
          );
        })
      );
      return fileName;
    });
};
