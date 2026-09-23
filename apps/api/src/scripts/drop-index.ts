import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * One-off maintenance: removes the superseded unique index on support_messages.
 *
 * The connection string is read from the environment — never hardcode credentials in
 * source, they end up in version control.
 *
 *   MONGODB_URI="mongodb+srv://..." npx ts-node src/scripts/drop-index.ts
 */
async function dropIndex() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to apps/api/.env or pass it inline.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('support_messages');

    console.log('Attempting to drop index: support_message_company_whatsapp_message_unique');
    await collection.dropIndex('support_message_company_whatsapp_message_unique');
    console.log('Successfully dropped old index.');
  } catch (error: any) {
    console.error('Failed to drop index (it might not exist or already dropped):', error.message);
  } finally {
    await client.close();
  }
}

dropIndex();
