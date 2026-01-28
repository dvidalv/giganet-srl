import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
 
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, username, password, 2FA token, etc.
      credentials: {
        email: {label: "Email", type: "email", placeholder: "jsmith@example.com"},
        password: {label: "Password", type: "password", placeholder: "Password"},
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.email || !credentials?.password) {
            // Retornar null en lugar de lanzar error para credenciales faltantes
            return null
          }

          // Dynamically import Node.js-only modules to avoid edge runtime issues
          const { passwordCompare } = await import("@/utils/utils")
          const User = (await import("@/app/models/user")).default

          // Find user by email and include password field
          const user = await User.findOne({ email: credentials.email.toLowerCase().trim() }).select("+password")
   
          if (!user) {
            // No user found - retornar null para credenciales inválidas
            return null
          }

          // Verify password by comparing plaintext with stored hash
          const isPasswordValid = passwordCompare(credentials.password, user.password)
          
          if (!isPasswordValid) {
            // Contraseña incorrecta - retornar null para credenciales inválidas
            return null
          }

          // Verificar si el email está verificado
          // Esta verificación la hacemos en el action antes de llamar a signIn
          // para poder mostrar un mensaje más específico
          if (!user.isVerified) {
            // Email no verificado - retornar null
            return null
          }

          // Convert to object and remove password before returning
          const userObject = user.toObject()
          delete userObject.password

          // return user object with their profile data
          return {
            id: userObject._id.toString(),
            email: userObject.email,
            name: userObject.name,
            ...userObject
          }
        } catch (error) {
          // Solo lanzar errores para problemas reales del sistema (BD, etc.)
          console.error("Error en authorize:", error)
          return null
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
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.id) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    },
  },
});