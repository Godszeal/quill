import { cookies } from "next/headers";

const SESSION_NAME = "quill_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

function setSessionCookie(token: string) {
  const store = cookies();
  store.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
}

export function clearSessionCookie() {
  const store = cookies();
  store.set(SESSION_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function getSessionCookie(): string | null {
  try {
    const store = cookies();
    return store.get(SESSION_NAME)?.value || null;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser): Promise<string> {
  const { createSessionToken } = await import("./jwt");
  const token = createSessionToken(user);
  setSessionCookie(token);
  return token;
}

export { SESSION_NAME };
