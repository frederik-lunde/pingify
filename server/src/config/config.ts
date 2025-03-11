import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || '',
};
