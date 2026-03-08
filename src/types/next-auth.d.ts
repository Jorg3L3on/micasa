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
  }

  interface Session {
    user: User & {
      id: string;
      company_id: number;
      company_name: string;
      company_is_system: boolean;
      houses: { id: number; name: string }[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    company_id?: number;
    company_name?: string;
    company_is_system?: boolean;
    houses?: { id: number; name: string }[];
  }
}
