import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const STUDENT_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/student_login_check"

const TEACHER_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/teacher_login_check"

interface XanoStudent {
  id: string
  studentEmail: string
  firstName: string
  lastName: string
  profileImage: string
}

interface XanoTeacher {
  id: string
  email: string
  firstName: string
  lastName: string
  profileImage?: string
  [key: string]: unknown
}

async function lookupStudent(email: string): Promise<XanoStudent | null> {
  try {
    const url = new URL(STUDENT_LOGIN_CHECK_ENDPOINT)
    url.searchParams.set("email", email)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data === "null") return null

    return data as XanoStudent
  } catch {
    return null
  }
}

async function lookupTeacher(email: string): Promise<XanoTeacher | null> {
  try {
    const url = new URL(TEACHER_LOGIN_CHECK_ENDPOINT)
    url.searchParams.set("email", email)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data === "null") return null

    return data as XanoTeacher
  } catch {
    return null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      const student = await lookupStudent(user.email)
      if (student) return true

      const teacher = await lookupTeacher(user.email)
      if (teacher) return true

      return false
    },
    async jwt({ token, trigger }) {
      if (trigger === "signIn" && token.email) {
        const student = await lookupStudent(token.email)
        if (student) {
          token.role = "student"
          token.students_id = student.id
          token.firstName = student.firstName
          token.lastName = student.lastName
          token.profileImage = student.profileImage
          return token
        }

        const teacher = await lookupTeacher(token.email)
        if (teacher) {
          token.role = "admin"
          token.teachers_id = teacher.id
          token.firstName = teacher.firstName
          token.lastName = teacher.lastName
          token.profileImage = teacher.profileImage ?? ""
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as Record<string, unknown>
        u.role = token.role
        u.students_id = token.students_id
        u.teachers_id = token.teachers_id
        if (token.firstName && token.lastName) {
          u.name = `${token.firstName} ${token.lastName}`
        }
        if (token.profileImage) {
          u.image = token.profileImage
        }
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith("/")) return `${baseUrl}${url}`
      return `${baseUrl}/dashboard`
    },
  },
  session: {
    strategy: "jwt",
  },
}
