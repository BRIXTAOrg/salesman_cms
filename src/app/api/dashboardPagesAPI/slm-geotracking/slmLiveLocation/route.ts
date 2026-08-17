// src/app/api/dashboardPagesAPI/slm-geotracking/slmLiveLocation/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { withTenantDb } from '@/lib/auth';

const FIREBASE_DB_URL = "https://eurofoam-5a36a-default-rtdb.firebaseio.com";

export const GET = withTenantDb(async (request, db, session) => {
  try {
    // 1. Fetch the raw JSON from Firebase. 
    // We MUST use 'no-store' so Next.js doesn't cache the GPS coordinates!
    const response = await fetch(`${FIREBASE_DB_URL}/live_locations.json`, {
      cache: 'no-store' 
    });

    if (!response.ok) {
      throw new Error(`Firebase responded with status: ${response.status}`);
    }

    const data = await response.json();

    // If database is completely empty
    if (!data) {
      return NextResponse.json([]);
    }

    const now = Date.now();

    // 2. Map into an array that matches the Zod schema.
    const mappedLocations = Object.keys(data).map((userId) => {
      const loc = data[userId];
      
      // If they haven't moved in 60 minutes, mark them as inactive
      const isStale = (now - loc.timestamp) > (60 * 60 * 1000); 

      return {
        userId: userId,
        salesmanName: loc.name || 'Unknown',
        employeeId: userId,
        role: loc.role || 'sales', 
        zone: null, 
        area: null,   
        latitude: loc.lat,
        longitude: loc.lng,
        recordedAt: new Date(loc.timestamp).toISOString(),
        isActive: !isStale,
      };
    });

    return NextResponse.json(mappedLocations, { status: 200 });
  } catch (error) {
    console.error("Live Location Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
});