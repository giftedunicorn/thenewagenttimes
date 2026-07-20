import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod/v4";

const FirebaseServiceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  project_id: z.string().min(1),
});

export const parseFirebaseServiceAccount = (value: string) => {
  try {
    const parsed = FirebaseServiceAccountSchema.parse(JSON.parse(value));

    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replaceAll("\\n", "\n"),
      projectId: parsed.project_id,
    };
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid");
  }
};

export const getFirebaseAdminAuth = (serviceAccountJson: string) => {
  const serviceAccount = parseFirebaseServiceAccount(serviceAccountJson);
  const appName = `thenewaitimes-admin-${serviceAccount.projectId}`;
  const app =
    getApps().find((candidate) => candidate.name === appName) ??
    initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      appName,
    );

  return getAuth(app);
};
