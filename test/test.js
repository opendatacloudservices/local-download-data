const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({path: path.join(__dirname, '../.env')});

const {Client} = require('pg');

const {nameFromFile, download} = require('../build/download');
const {getFile} = require('../build/postgres/index');
const {isWfs, removeRequests, wfs, ogr2ogrUrlPrepare} = require('../build/special/wfs');
const {accept} = require('../build/accept');
const {tempName, directDownload} = require('../build/utils');

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

const getClient = async () => {
  // connect to postgres (via env vars params)
  const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
  });
  await client.connect();
  return client;
};

jest.setTimeout(10000000);

// test('isWfs', async () => {
//   const result = await isWfs('https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_wfs_alkis');

//   expect(result).toBe(true);
// });

// test('download Process', async () => {
//   const client = await getClient();
//   const file = await getFile(client, 999389);
//   const acceptance = accept(file);
//   expect(acceptance).toBe(false);
// });

// test('nameFromFile', async () => {
//   const name = nameFromFile({
//     url: 'https://geodienste.hamburg.de/HH_WFS_Stoerfallbetriebe?SERVICE=WFS&amp;REQUEST=GetFeature&amp;VERSION=1.1.0&amp;TypeName=app:stoerfallbetrieb',
//     id: 123
//   });
//   expect(name).toBe('123--HH_WFS_Stoerfallbetriebe');
// })

// test('removeRequests', async () => {
//   const url = removeRequests('https://geodienste.hamburg.de/HH_WFS_xplan_dls?service=WFS&request=GetFeature&version=2.0.0&resolvedepth=*&StoredQuery_ID=urn:ogc:def:query:OGC-WFS::PlanName&planName=TB280');
//   expect(url).toBe('https://geodienste.hamburg.de/HH_WFS_xplan_dls?service=WFS&version=2.0.0&resolvedepth=*&StoredQuery_ID=urn:ogc:def:query:OGC-WFS::PlanName&planName=TB280');
  
//   expect(removeRequests('www?request=GetFeature')).toBe('www');
//   expect(removeRequests('www?request=GetFeature&service=wfs')).toBe('www?service=wfs');
//   expect(removeRequests('www?service=wfs&request=GetFeature')).toBe('www?service=wfs');
//   expect(removeRequests('www?service=wfs&request=GetFeature&hello=world')).toBe('www?service=wfs&hello=world');
// })

// test('wms', async () => {
//   const file = {
//     id: 123,
//     url: 'https://geodienste.komm.one/ows/services/org.473.227b3b87-2d4b-4207-ad9a-4619d89dce48_wms/org.473.10e4cc04-a4bb-4bf8-bbb1-d9c79bccfc8b?SERVICE=WMS&amp;Request=GetCapabilities',
//     file: null,
//     state: 'new',
//     downloaded: null,
//     format: 'wms',
//     mimetype: 'false',
//   };
//   expect(accept(file)).toBe(false);
// })

// const testWfs = {
//   id: 123,
//   url: 'https://geodienste.komm.one/ows/services/org.97.4df96e27-4729-4858-be59-7aa798dcfd98_wfs/org.97.77d9e4db-d5fd-4cde-8598-e6c41754022b?SERVICE=WFS&amp;Request=GetCapabilities',
//   file: null,
//   state: 'new',
//   downloaded: null,
//   format: 'wfs',
//   mimetype: 'false',
// };

// test('isWfs', async () => {
//   expect(await isWfs(testWfs.url)).toBe(true);
// });

// jest.setTimeout(300000);
// test('wfs', async () => {
//   const file = await wfs(testWfs, 'test_test_tes')
//   .catch(err => console.log(err));

//   expect(file.source).toBe('test_test_tes');
//   expect(file.files.length).toBe(4);
// })

// test('tempName', async () => {
//   const name = tempName();
//   expect(name.length).toBe(40);
//   expect(name.substr(0,4)).toBe('tmp/');
// })

// test('directDownload', async () => {
//   const name = tempName();
//   const result = await directDownload('https://www.google.com', name);
//   expect(fs.existsSync(name)).toBe(true);
//   // cleaning up
//   fs.unlinkSync(name);
// })

// test('wfs - 1029766', async () => {
//   const client = await getClient();
//   const file = await getFile(client, 1029766);
//   expect(file.id).toBe(1029766);
//   expect(await isWfs(file.url)).toBe(false);
//   const result = await download(file);
//   expect(result.source).toBe('1029766--HH_WFS_xplan_dls');
// })

// test('wfs - 540329', async () => {
//   const client = await getClient();
//   const file = await getFile(client, 540329);
//   expect(file.id).toBe(540329);
//   expect(await isWfs(file.url)).toBe(true);
//   const result = await download(file);
//   expect(result.source).toBe('540329--org.157.3b1b6019-09a2-4dba-b22f-ccb376f2f78d');
//   expect(result.files.length).toBe(2);
// })

// test('ogr2ogrUrlPrepare', () => {
//   const urls = [
//     [
//       'https://geoportal.saarland.de/mapbender/php/wfs.php?INSPIRE=1&amp;FEATURETYPE_ID=1761&amp;REQUEST=GetCapabilities&amp;SERVICE=WFS&amp;VERSION=2.0.0',
//       'https://geoportal.saarland.de/mapbender/php/wfs.php?INSPIRE=1&FEATURETYPE_ID=1761'
//     ],
//     [
//       'http://kommisdd.ogc.dresden.de/net3/public/ogc.ashx?NodeId=1247&Service=WFS&Request=GetCapabilities',
//       'http://kommisdd.ogc.dresden.de/net3/public/ogc.ashx?NodeId=1247'
//     ]
//   ];
//   urls.forEach(url => {
//     expect(ogr2ogrUrlPrepare(url[0])).toBe(url[1]);
//   });
// });

test('wfs - 808247', async () => {
  const client = await getClient();
  const file = await getFile(client, 808247);
  expect(file.id).toBe(808247);
  expect(await isWfs(file.url)).toBe(true);
  const result = await download(file);
  expect(result.source).toBe('808247--HH_WFS_xplan_dls');
  expect(result.files.length).toBe(192);
})

