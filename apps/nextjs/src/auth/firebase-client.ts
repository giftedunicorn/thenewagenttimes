interface FirebaseTokenUser {
  getIdToken: () => Promise<string>;
}

export async function createFirebaseAuthorizationHeaders(
  user: FirebaseTokenUser | null,
) {
  const headers = new Headers();
  headers.set("x-trpc-source", "nextjs-react");

  if (!user) return headers;

  const token = await user.getIdToken();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

export function isValidLoginEmail(value: string) {
  const email = value.trim();

  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function shouldUseFirebaseRedirect(userAgent: string) {
  return /iPad|iPhone|iPod/.test(userAgent);
}
