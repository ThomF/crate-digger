import { defineConfig } from 'drizzle-kit'

// Used by drizzle-kit (db:generate, db:studio). The app itself doesn't read this file.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? '../../data/crate.db',
  },
})
