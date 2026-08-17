// src/app/actions/cache.ts
'use server';
import { revalidateTag } from 'next/cache';
import { verifySession } from '@/lib/auth';

export async function refreshCompanyCache(cachePrefix: string) {
  try {
    const session = await verifySession();
    if (!session?.userId || !session.schemaName) {
      return { success: false, error: 'Unauthorized' };
    }

    // Define tags that are global and shouldn't get a schema attached
    const globalTags = [''];

    // Matches the tag format the cached route functions use (e.g.
    // dealerManagement's `dealers-global-${schemaName}`) -- this used to
    // key off userId instead of schemaName, which never matched those
    // tags at all, so this action was silently a no-op.
    const targetTag = globalTags.includes(cachePrefix)
      ? cachePrefix
      : `${cachePrefix}-global-${session.schemaName}`;

    // Nuke the cache!
    revalidateTag(targetTag, { expire: 0 });

    return { success: true, message: `Cache cleared for ${targetTag}` };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: 'Failed to clear cache' };
  }
}