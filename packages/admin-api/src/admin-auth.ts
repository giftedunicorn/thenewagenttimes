export interface AdminIdentity {
  email: string;
  image: string | null;
  name: string;
  uid: string;
}

export type AdminSessionReader = (
  headers: Headers,
) => Promise<AdminIdentity | null>;

export const parseAdminEmails = (value: string) => {
  const emails = new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (emails.size === 0) {
    throw new Error("ADMIN_EMAILS must not be empty");
  }

  return emails;
};
