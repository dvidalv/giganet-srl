import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "jsmith@example.com",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Password",
        },
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const { passwordCompare } = await import("@/utils/utils");
          const User = (await import("@/app/models/user")).default;

          const user = await User.findOne({
            email: credentials.email.toLowerCase().trim(),
          }).select("+password");

          if (!user) {
            return null;
          }

          const isPasswordValid = passwordCompare(
            credentials.password,
            user.password,
          );

          if (!isPasswordValid) {
            return null;
          }

          if (user.isVerified !== true) {
            return null;
          }

          if (user.isActive === false) {
            return null;
          }

          const userObject = user.toObject();
          delete userObject.password;

          return {
            id: userObject._id.toString(),
            email: userObject.email,
            name: userObject.name,
            image: userObject.image || "",
            ...userObject,
          };
        } catch (error) {
          console.error("Error en authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image || "";
        token.role = user.role;
        const ambiente = user?.empresa?.theFactoryAmbiente;
        token.theFactoryAmbiente =
          ambiente === "demo" || ambiente === "production"
            ? ambiente
            : "production";
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (!token.id) return session;

      session.user.id = token.id;
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.image = token.image || "";
      session.user.role = token.role;
      session.user.theFactoryAmbiente =
        token.theFactoryAmbiente === "demo" ? "demo" : "production";

      // Refresh profile fields from DB so Mi perfil updates appear after router.refresh()
      try {
        const User = (await import("@/app/models/user")).default;
        const dbUser = await User.findById(token.id)
          .select("name email image role empresa.theFactoryAmbiente")
          .lean();
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.email = dbUser.email;
          session.user.image = dbUser.image || "";
          session.user.role = dbUser.role;
          const ambiente = dbUser?.empresa?.theFactoryAmbiente;
          if (ambiente === "demo" || ambiente === "production") {
            session.user.theFactoryAmbiente = ambiente;
          }
        }
      } catch (err) {
        console.error("Error syncing session profile:", err);
      }

      return session;
    },
  },
});
