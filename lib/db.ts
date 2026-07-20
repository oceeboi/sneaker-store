import Database from '@/database/database';

async function connect_to_database() {
  const db = Database.getInstance();
  await Promise.all([
    import('@/models/Product'),
    import('@/models/Brand'),
    import('@/models/Category'),
    import('@/models/Collection'),
    import('@/models/Auditlog'),
    import('@/models/User'),
    import('@/models/UserProfile'),
    import('@/models/Account'),
    import('@/models/Address'),
    import('@/models/Cart'),
    import('@/models/InventoryMovement'),
    import('@/models/Notification'),
    import('@/models/Order'),
    import('@/models/Referral'),
    import('@/models/PlatformSettings'),
    import('@/models/Transaction'),
  ]);
  await db.connect();
}

export default connect_to_database;
