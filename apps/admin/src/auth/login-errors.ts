export const getAdminLoginErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("auth/popup-closed-by-user")) {
    return "Sign-in cancelled.";
  }

  if (message.includes("auth/popup-blocked")) {
    return "Pop-up blocked. Allow pop-ups and try again.";
  }

  if (message.includes("admin-access-denied")) {
    return "This account does not have admin access.";
  }

  return "Unable to sign in. Try again.";
};
