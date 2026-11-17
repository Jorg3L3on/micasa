import 'next-auth';

declare module 'next-auth' {
  interface User {
    company_id?: number;
    company_name?: string;
    company_is_system?: boolean;
    company?: {
      id: number;
      name: string;
      is_system: boolean;
    };
    houses?: { id: number; name: string }[];
    /** Session id minted at login (see auth-authorize.ts). */
    sid?: string;
  }

  interface Session {
    user: User & {
      id: string;
      company_id: number;
      company_name: string;
      company_is_system: boolean;
      houses: { id: number; name: string }[];
    };
    /** One per login; copied onto audit rows and auth events. */
    sid?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    company_id?: number;
    company_name?: string;
    company_is_system?: boolean;
    houses?: { id: number; name: string }[];
    sid?: string;
  }
}
