export {}

// Create a type for the roles
export type Roles = 'doctor_general' | 'enfermera_jefe'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles
    }
  }
}
