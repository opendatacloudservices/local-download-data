"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, '../../.env') });
// connect to postgres (via env vars params)
const client = new pg_1.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();
const index_1 = require("./index");
(0, index_1.fixMissingDownloadedFiles)(client);
//# sourceMappingURL=migrate.js.map