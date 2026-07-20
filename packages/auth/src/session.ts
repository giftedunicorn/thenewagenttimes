export interface AppSession {
  expiresAt: Date;
  user: {
    email: string;
    emailVerified: boolean;
    id: string;
    image: string | null;
    name: string;
  };
}

export type SessionReader = (headers: Headers) => Promise<AppSession | null>;
