import {
  NextRequest,
  NextResponse,
} from "next/server";


function backendOrigin() {
  return String(
    process.env
      .BRIXTA_BACKEND_ORIGIN ??
      "",
  )
    .trim()
    .replace(
      /\/+$/,
      "",
    );
}


function allowed(
  method: string,
  pieces: string[],
) {
  /*
   * GET qr-rewards/{tenant}/{token}
   */
  if (
    method ===
      "GET" &&
    pieces.length ===
      3 &&
    pieces[0] ===
      "qr-rewards"
  ) {
    return true;
  }

  /*
   * GET runtime/{tenant}/{responsibilityKey}
   */
  if (
    method ===
      "GET" &&
    pieces.length ===
      3 &&
    pieces[0] ===
      "runtime"
  ) {
    return true;
  }

  /*
   * CURRENT MILESTONE:
   *
   * verify_upi ONLY.
   */
  if (
    method ===
      "POST" &&
    pieces.length ===
      5 &&
    pieces[0] ===
      "runtime" &&
    pieces[3] ===
      "actions" &&
    pieces[4] ===
      "verify_upi"
  ) {
    return true;
  }

  /*
   * Service request polling.
   */
  if (
    method ===
      "GET" &&
    pieces.length ===
      5 &&
    pieces[0] ===
      "runtime" &&
    pieces[3] ===
      "service-requests"
  ) {
    return true;
  }

  return false;
}


async function forward(
  request: NextRequest,
  context: {
    params:
      Promise<{
        path: string[];
      }>;
  },
) {
  const {
    path,
  } =
    await context.params;

  const pieces =
    Array.isArray(
      path,
    )
      ? path
      : [];

  if (
    !allowed(
      request.method,
      pieces,
    )
  ) {
    return NextResponse.json(
      {
        success: false,

        error:
          "Public reward operation is not allowed.",
      },
      {
        status: 404,
      },
    );
  }

  const origin =
    backendOrigin();

  if (!origin) {
    return NextResponse.json(
      {
        success: false,

        error:
          "BRIXTA reward backend is not configured.",
      },
      {
        status: 503,
      },
    );
  }

  const encodedPath =
    pieces
      .map(
        encodeURIComponent,
      )
      .join(
        "/",
      );

  const target =
    `${origin}/api/public/${encodedPath}${request.nextUrl.search}`;

  const headers =
    new Headers();

  headers.set(
    "accept",
    "application/json",
  );

  const externalSession =
    request.headers.get(
      "x-brixta-external-session",
    );

  if (
    externalSession
  ) {
    headers.set(
      "x-brixta-external-session",
      externalSession,
    );
  }

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  if (
    forwardedFor
  ) {
    headers.set(
      "x-forwarded-for",
      forwardedFor,
    );
  }

  let body:
    string | undefined;

  if (
    request.method ===
      "POST"
  ) {
    headers.set(
      "content-type",
      "application/json",
    );

    body =
      await request.text();
  }

  try {
    const response =
      await fetch(
        target,
        {
          method:
            request.method,

          headers,

          body,

          cache:
            "no-store",
        },
      );

    const text =
      await response.text();

    return new NextResponse(
      text,
      {
        status:
          response.status,

        headers: {
          "content-type":
            response.headers.get(
              "content-type",
            ) ??
            "application/json; charset=utf-8",

          "cache-control":
            "no-store",
        },
      },
    );
  } catch (cause) {
    console.error(
      "BRIXTA public reward proxy failed:",
      cause,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Reward service is temporarily unavailable.",
      },
      {
        status: 502,
      },
    );
  }
}


export const GET =
  forward;

export const POST =
  forward;
