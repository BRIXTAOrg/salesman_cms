import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// This finds your .env file
dotenv.config({ path: '.env.local' }); 

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env.local file');
}

export default defineConfig({
  // This tells Drizzle where to find your schema
  schema: [
    "./src/db/schema.ts",
    "./src/db/applianceSchema.ts",
    "./src/db/publicSchema.ts",
  ],
  
  // This tells Drizzle where to put the migration files
  out: './drizzle/migrations', 
  
  dialect: 'postgresql',
  dbCredentials: {
    // This securely reads your database connection string
    url: process.env.DATABASE_URL,
  },
  //schemaFilter: [process.env.DB_SCHEMA ?? "public"],
  verbose: true,
  strict: true,
});