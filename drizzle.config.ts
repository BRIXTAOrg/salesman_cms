import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// This finds your .env file
dotenv.config({ path: '.env.local' }); 

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env.local file');
}

export default defineConfig({
  // This tells Drizzle where to find your schema
  schema: './drizzle/schema.ts',
  
  // This tells Drizzle where to put the migration files
  out: './drizzle/migrations', 
  
  dialect: 'postgresql',
  dbCredentials: {
    // This securely reads your database connection string
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["kamdhenu"], 
  verbose: true,
  strict: true,
});