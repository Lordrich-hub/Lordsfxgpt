export const isAuthConfigured = (): boolean => {
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasSecret = Boolean(process.env.NEXTAUTH_SECRET);
  const hasDb = Boolean(process.env.DATABASE_URL);
  return hasGoogle && hasSecret && hasDb;
};
