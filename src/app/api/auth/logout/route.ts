// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { forgetCompanyLinks } from '@/lib/company-links';

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();

    // Destroy the auth token
    cookieStore.delete('auth_token');

    // BRIXTA_COMPANY_SWITCH_PROOF_V1: signing out also forgets which
    // companies this browser may switch into without a password.
    await forgetCompanyLinks();

    // Back to the sign-in page. 303 makes the browser follow with a GET
    // (a 307 would re-POST the form to "/").
    return NextResponse.redirect(new URL('/login', request.url), 303);
}
