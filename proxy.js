import { auth } from "@/auth"
import { NextResponse } from "next/server"

// Rutas que existen en la aplicación (listado único)
const EXISTING_ROUTES = [
  "/",
  "/login",
  "/register",
  "/contacto",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
]

// Rutas públicas (no requieren autenticación)
const PUBLIC_ROUTES = ["/", "/login", "/register", "/contacto", "/forgot-password", "/reset-password"]

function routeExists(pathname) {
  return EXISTING_ROUTES.some(
    (route) => route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/")
  )
}

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some(
    (route) => route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(route + "/")
  )
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // API comprobantes: solo API Key en el route handler; no aplicar reglas de páginas ni login.
  if (pathname.startsWith("/api/comprobantes")) {
    // stderr: en algunos IDEs los console.log del proxy se mezclan o no destacan; error es más visible.
    console.error("[giganet/proxy → API]", req.method, pathname)
    return NextResponse.next()
  }

  // Si la ruta NO existe → redirigir a login (o dashboard si ya está autenticado)
  if (!routeExists(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si intenta acceder a una ruta protegida sin estar autenticado → redirigir a login
  if (!isPublicRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si está autenticado e intenta acceder a login/register → redirigir al dashboard
  if ((pathname.startsWith("/login") || pathname.startsWith("/register")) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

// Configurar qué rutas deben ejecutar el proxy
export const config = {
  matcher: [
    "/api/comprobantes/:path*",
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
