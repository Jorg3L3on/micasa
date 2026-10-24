import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authorizeCredentials } from './auth-authorize';
import { jwtCallback, sessionCallback, signOutEvent } from './auth-callbacks';

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
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
  events: {
    signOut: signOutEvent,
  },
});
