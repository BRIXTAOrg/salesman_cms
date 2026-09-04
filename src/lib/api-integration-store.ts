import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import {
  eq,
} from "drizzle-orm";

import {
  platformMeta,
} from "../../drizzle/platformVNextSchema";

import type {
  AppDatabase,
} from "@/lib/drizzle";

import type {
  ApiIntegrationDefinition,
  ApiIntegrationPublic,
} from "@/lib/api-integration-contract";


const REGISTRY_KEY =
  "api_integration_registry_v1";


type StoredApiIntegration =
  ApiIntegrationDefinition & {
    encryptedCredentials:
      Record<string, string>;
  };


type StoredRegistry = {
  version: 1;

  integrations:
    StoredApiIntegration[];
};


function encryptionKey() {
  const source =
    process.env
      .BRIXTA_INTEGRATION_SECRET_KEY ||
    process.env
      .JWT_SECRET;

  if (
    !source
  ) {
    throw new Error(
      "Set BRIXTA_INTEGRATION_SECRET_KEY or JWT_SECRET before storing API credentials.",
    );
  }

  return createHash(
    "sha256",
  )
    .update(
      source,
      "utf8",
    )
    .digest();
}


function encryptSecret(
  value: string,
) {
  const iv =
    randomBytes(
      12,
    );

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      encryptionKey(),
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8",
      ),

      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString(
      "base64url",
    ),
    tag.toString(
      "base64url",
    ),
    encrypted.toString(
      "base64url",
    ),
  ].join(
    ".",
  );
}


function decryptSecret(
  value: string,
) {
  const [
    version,
    ivRaw,
    tagRaw,
    encryptedRaw,
  ] =
    value.split(
      ".",
    );

  if (
    version !== "v1" ||
    !ivRaw ||
    !tagRaw ||
    !encryptedRaw
  ) {
    throw new Error(
      "Invalid encrypted integration credential.",
    );
  }


  const decipher =
    createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(
        ivRaw,
        "base64url",
      ),
    );

  decipher.setAuthTag(
    Buffer.from(
      tagRaw,
      "base64url",
    ),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(
        encryptedRaw,
        "base64url",
      ),
    ),

    decipher.final(),
  ]).toString(
    "utf8",
  );
}


function normalizeRegistry(
  value: unknown,
): StoredRegistry {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      version:
        1,

      integrations:
        [],
    };
  }

  const raw =
    value as
    Partial<StoredRegistry>;

  return {
    version:
      1,

    integrations:
      Array.isArray(
        raw.integrations,
      )
        ? raw.integrations
        : [],
  };
}


export async function readApiIntegrationRegistry(
  db: AppDatabase,
) {
  const rows =
    await db
      .select({
        value:
          platformMeta.value,
      })
      .from(
        platformMeta,
      )
      .where(
        eq(
          platformMeta.key,
          REGISTRY_KEY,
        ),
      )
      .limit(
        1,
      );

  return normalizeRegistry(
    rows[0]
      ?.value,
  );
}


async function writeRegistry(
  db: AppDatabase,
  registry: StoredRegistry,
) {
  await db
    .insert(
      platformMeta,
    )
    .values({
      key:
        REGISTRY_KEY,

      value:
        registry,

      updatedAt:
        new Date(),
    })
    .onConflictDoUpdate({
      target:
        platformMeta.key,

      set: {
        value:
          registry,

        updatedAt:
          new Date(),
      },
    });
}


export function publicIntegration(
  integration:
    StoredApiIntegration,
): ApiIntegrationPublic {
  const credentialStatus =
    Object.fromEntries(
      integration.auth
        .credentialFields
        .map(
          (
            field,
          ) => [
            field.key,
            Boolean(
              integration
                .encryptedCredentials
                ?.[field.key],
            ),
          ],
        ),
    );

  const {
    encryptedCredentials:
      _encryptedCredentials,

    ...definition
  } =
    integration;

  return {
    ...definition,
    credentialStatus,
  };
}


export async function listApiIntegrations(
  db: AppDatabase,
) {
  const registry =
    await readApiIntegrationRegistry(
      db,
    );

  return registry.integrations
    .map(
      publicIntegration,
    )
    .sort(
      (
        a,
        b,
      ) =>
        a.name.localeCompare(
          b.name,
        ),
    );
}


export async function saveApiIntegration(
  db: AppDatabase,
  definition:
    ApiIntegrationDefinition,
  suppliedSecrets:
    Record<string, string>,
) {
  const registry =
    await readApiIntegrationRegistry(
      db,
    );

  const index =
    registry.integrations
      .findIndex(
        (
          item,
        ) =>
          item.id ===
          definition.id,
      );


  const existing =
    index >= 0
      ? registry.integrations[
          index
        ]
      : null;


  const encryptedCredentials = {
    ...(
      existing
        ?.encryptedCredentials ??
      {}
    ),
  };


  for (
    const [
      key,
      value,
    ] of Object.entries(
      suppliedSecrets,
    )
  ) {
    if (
      !value.trim()
    ) {
      continue;
    }

    encryptedCredentials[
      key
    ] =
      encryptSecret(
        value,
      );
  }


  const now =
    new Date()
      .toISOString();


  const stored:
    StoredApiIntegration = {
    ...definition,

    createdAt:
      existing
        ?.createdAt ??
      definition
        .createdAt ??
      now,

    updatedAt:
      now,

    publishedAt:
      definition.status ===
        "published"
        ? definition
            .publishedAt ??
          now
        : null,

    encryptedCredentials,
  };


  if (
    index >= 0
  ) {
    registry.integrations[
      index
    ] =
      stored;
  } else {
    registry.integrations.push(
      stored,
    );
  }


  await writeRegistry(
    db,
    registry,
  );


  return publicIntegration(
    stored,
  );
}


export async function deleteApiIntegration(
  db: AppDatabase,
  id: string,
) {
  const registry =
    await readApiIntegrationRegistry(
      db,
    );

  const before =
    registry.integrations
      .length;

  registry.integrations =
    registry.integrations
      .filter(
        (
          item,
        ) =>
          item.id !==
          id,
      );

  if (
    registry.integrations
      .length ===
    before
  ) {
    return false;
  }

  await writeRegistry(
    db,
    registry,
  );

  return true;
}


export async function getStoredApiIntegration(
  db: AppDatabase,
  id: string,
) {
  const registry =
    await readApiIntegrationRegistry(
      db,
    );

  return (
    registry.integrations
      .find(
        (
          item,
        ) =>
          item.id ===
          id,
      ) ??
    null
  );
}


export function integrationCredentials(
  integration:
    StoredApiIntegration,
) {
  const result:
    Record<string, string> =
    {};

  for (
    const [
      key,
      encrypted,
    ] of Object.entries(
      integration
        .encryptedCredentials ??
      {},
    )
  ) {
    result[key] =
      decryptSecret(
        encrypted,
      );
  }

  return result;
}
