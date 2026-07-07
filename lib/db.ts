import Database from '@/database/database';

async function connect_to_database() {
  const db = Database.getInstance();
  await import('@/models/Product');
  await import('@/models/Brand');
  await import('@/models/Category');
  await import('@/models/Collection');
  await import('@/models/Auditlog');
  await import('@/models/User');
  await db.connect();
}

export default connect_to_database;
