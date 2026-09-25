export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
};

export type AccessClaims = {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
};

export type AuthenticatedRequest = Express.Request & {
  auth: { userId: string; sessionId: string };
};

export type IssuedAuth = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};
