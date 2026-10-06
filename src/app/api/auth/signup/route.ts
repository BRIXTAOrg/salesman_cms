import { NextRequest, NextResponse } from "next/server";

import {
  clientAddress,
  consumeAttempt,
  tooManyAttemptsMessage,
} from "@/lib/login-throttle";
import { passwordProblem } from "@/lib/password";
import { provisionCompany } from "@/lib/tenant-provisioner";

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export async function POST(request: NextRequest) {
  // BRIXTA_SIGNUP_THROTTLE_V1: every signup creates a whole database
  // schema, so keep it to a handful per address per hour.
  const wait = consumeAttempt({
    key: `cms-signup:ip:${clientAddress(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (wait > 0) {
    return NextResponse.json(
      { error: tooManyAttemptsMessage(wait) },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    companyName,
    schemaName: rawSchemaName,
    officeAddress,
    contactNumber,
    companyEmail,
    adminName,
    adminEmail,
    adminPassword,
  } = body;

  if (
    !companyName ||
    !rawSchemaName ||
    !officeAddress ||
    !contactNumber ||
    !adminName ||
    !adminEmail ||
    !adminPassword
  ) {
    return NextResponse.json(
      {
        error:
          "Company name, code, office address, contact number, and admin details are required.",
      },
      { status: 400 },
    );
  }

  const schemaName = String(rawSchemaName).trim().toLowerCase();

  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    return NextResponse.json(
      {
        error:
          "Company code must start with a letter and contain only lowercase letters, numbers and underscores.",
      },
      { status: 400 },
    );
  }

  const weakPassword = passwordProblem(String(adminPassword));
  if (weakPassword) {
    return NextResponse.json(
      { error: weakPassword },
      { status: 400 },
    );
  }

  try {
    const result = await provisionCompany({
      companyName: String(companyName),
      schemaName,
      officeAddress: String(officeAddress),
      contactNumber: String(contactNumber),
      companyEmail: companyEmail ? String(companyEmail) : null,
      adminName: String(adminName),
      adminEmail: String(adminEmail),
      adminPassword: String(adminPassword),
    });

    return NextResponse.json(
      {
        message: "Company created",
        schemaName: result.schemaName,
        organizationId: result.organizationId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create company.";

    const status = message.includes("already taken") ? 409 : 500;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
