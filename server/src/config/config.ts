import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  shadowwDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
};
