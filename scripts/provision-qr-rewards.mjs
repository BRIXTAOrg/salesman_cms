import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({
  path: ".env.local",
});

const {
  Pool,
} = pg;

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing from .env.local",
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
});

function validSchema(value) {
  return /^[a-z][a-z0-9_]{0,62}$/.test(value);
}

async function main() {
  const client = await pool.connect();

  try {
    const organizations =
      await client.query(`
        SELECT
          name,
          schema_name
        FROM public.organizations
        WHERE is_provisioned = true
        ORDER BY name
      `);

    let schemaName =
      process.argv[2]?.trim();

    if (!schemaName) {
      if (organizations.rows.length === 1) {
        schemaName =
          organizations.rows[0].schema_name;

        console.log(
          `Using only provisioned tenant: ${schemaName}`,
        );
      } else {
        console.log(
          "\\nChoose a tenant schema:\\n",
        );

        for (
          const organization
          of organizations.rows
        ) {
          console.log(
            `  ${organization.schema_name}  (${organization.name})`,
          );
        }

        console.log(
          "\\nThen run:\\n"
          + "npm run qr-rewards:provision -- <schema_name>\\n",
        );

        process.exitCode = 2;
        return;
      }
    }

    if (!validSchema(schemaName)) {
      throw new Error(
        `Invalid tenant schema: ${schemaName}`,
      );
    }

    const registered =
      organizations.rows.some(
        (organization) =>
          organization.schema_name === schemaName,
      );

    if (!registered) {
      throw new Error(
        `Tenant schema is not registered: ${schemaName}`,
      );
    }

    const filePath = path.join(
      process.cwd(),
      "drizzle",
      "qr-rewards-provision.sql",
    );

    const contents =
      await fs.readFile(
        filePath,
        "utf8",
      );

    const statements =
      contents
        .split("--> statement-breakpoint")
        .map((statement) =>
          statement.trim(),
        )
        .filter(Boolean);

    await client.query("BEGIN");

    await client.query(
      "SET LOCAL statement_timeout = '60000ms'",
    );

    await client.query(
      `SET LOCAL search_path TO "${schemaName}", public`,
    );

    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query("COMMIT");

    console.log(
      `\\nQR Rewards schema V1 installed in ${schemaName}.\\n`,
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
