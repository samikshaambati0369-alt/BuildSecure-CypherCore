import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Enable SSL automatically for cloud MySQL (TiDB, Aiven, etc.)
if (process.env.DB_SSL === 'true' || process.env.DB_HOST?.includes('tidbcloud.com') || process.env.DB_HOST?.includes('aivencloud.com')) {
  poolConfig.ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  };
}

export const pool = mysql.createPool(poolConfig);
