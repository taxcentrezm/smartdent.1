import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,          // your LibSQL URL
  auth: { token: process.env.DATABASE_TOKEN }  // if applicable
});

export default client;   // default export
