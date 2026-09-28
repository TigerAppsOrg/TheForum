import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      netId: string;
      onboarded: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  /** Shape returned by the CAS provider's `authorize()`. */
  interface User {
    netId?: string;
    onboarded?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    netId?: string;
    onboarded?: boolean;
  }
}
