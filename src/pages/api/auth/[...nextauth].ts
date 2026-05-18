import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUserByEmail } from '../../../lib/users';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await findUserByEmail(credentials.email);
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, plan: user.plan };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.plan = (user as any).plan || 'free'; token.usage = 0; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) { (session.user as any).plan = token.plan; (session.user as any).usage = token.usage; }
      return session;
    },
  },
  session: { strategy: 'jwt' },
  pages: { signIn: '/', error: '/' },
  secret: process.env.NEXTAUTH_SECRET,
});
