import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "~": path.resolve(dirname, "src"),
    },
  },
  test: {
    env: {
      ADMIN_EMAILS: "admin@example.com",
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: "firebase-admin@example.com",
        private_key: "test-private-key",
        project_id: "test-project",
      }),
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test-project.appspot.com",
      NODE_ENV: "test",
      POSTGRES_URL: "postgres://test:test@localhost:5432/test",
    },
  },
});
