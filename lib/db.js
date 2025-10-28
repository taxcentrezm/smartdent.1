import { createClient } from '@libsql/client';

// This must match your environment variable
const client = createClient({
  url: process.env.DATABASE_URL,
  auth: { token: process.env.DATABASE_TOKEN } // if using token
});

export default client;
