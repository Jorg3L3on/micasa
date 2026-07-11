import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Dynamic import: Prisma only runs in Node (auth API route), never in proxy
        const prisma = (await import('./prisma')).default;

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          include: {
            memberships: { include: { house: true } },
          },
        });

        if (!user) {
          return null;
        }

        if (!user.active) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        const houses = user.memberships.map((m) => ({
          id: m.house.id,
          name: m.house.name,
        }));

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          houses,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.houses = user.houses?.map((h) => ({ id: h.id, name: h.name })) ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.houses = (token.houses ?? []) as { id: number; name: string }[];
      }
      return session;
    },
  },
});
