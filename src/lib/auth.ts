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

        // Dynamic import: db/Prisma only run in Node (auth API route), never in proxy
        const { db } = await import('./db');

        const user = await db.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          include: {
            houses: true,
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        console.log('Authorized user:', {
          id: String(user.id),
          email: user.email,
          name: user.name,
          houses: user.houses,
        });

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          houses: user.houses,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log('JWT Callback - User:', user);
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      console.log('JWT Callback - Token:', token);
      return token;
    },
    async session({ session, token }) {
      if (token) {
        console.log('Session Callback - Token:', token);
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      console.log('Session Callback - Session:', session);
      return session;
    },
  },
});
