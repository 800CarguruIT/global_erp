import { NextResponse } from "next/server";

function isUnauthorized(message: string) {
  return message.toLowerCase().includes("unauthorized");
}

export function getMobileErrorStatus(message: string): number {
  const normalized = message.toLowerCase();
  if (isUnauthorized(normalized)) {
    return normalized.includes("company") ? 403 : 401;
  }
  return 500;
}

export function createMobileErrorResponse(
  message: string,
  status?: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra ?? {}),
    },
    {
      status: status ?? getMobileErrorStatus(message),
    }
  );
}

export function createMobileSuccessResponse(payload: Record<string, unknown>, status?: number) {

  return NextResponse.json(
    {
      success: true,
      data: payload,
    },
    {
      status: status ?? 200,
    }
  );
}

export function handleMobileError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return createMobileErrorResponse(message);
}
