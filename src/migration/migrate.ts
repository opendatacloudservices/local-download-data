import {Client} from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({path: path.join(__dirname, '../../.env')});

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

import {fixMissingDownloadedFiles} from './index';
fixMissingDownloadedFiles(client);
