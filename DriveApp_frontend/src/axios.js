import axios from "axios";

// Instancia base que apunta a nuestro backend .NET
export const api = axios.create({
  baseURL: "http://localhost:5217/api", // Cambia el puerto si tu backend corre en otro
  timeout: 10000,
});

// ── Interceptor de request ────────────────────────────────────────────────────
// Antes de CADA petición, leemos el accessToken del localStorage y lo metemos
// en el header Authorization. Así no tenemos que recordar hacerlo manualmente.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Interceptor de response ───────────────────────────────────────────────────
// Si el backend devuelve 401 (token expirado), intentamos automáticamente
// pedir un nuevo accessToken usando el refreshToken. Si eso también falla,
// mandamos al usuario al login.
api.interceptors.response.use(
  (response) => response, // Si todo está bien, devolvemos la respuesta normal
  async (error) => {
    const original = error.config;

    // Solo intentamos refrescar si:
    // 1. El error es 401 (no autorizado)
    // 2. No lo hemos intentado ya (para evitar bucles infinitos)
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const { data } = await api.post("/auth/getNewAccessToken", {
          accessToken: refreshToken,
        });

        // Guardamos el nuevo accessToken y reintentamos la petición original
        localStorage.setItem("accessToken", data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Si el refresh también falla, la sesión expiró: vamos al login
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
