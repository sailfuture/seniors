import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role?: "student" | "admin"
      students_id?: string
      teachers_id?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "student" | "admin"
    students_id?: string
    teachers_id?: string
    firstName?: string
    lastName?: string
    profileImage?: string
  }
}
