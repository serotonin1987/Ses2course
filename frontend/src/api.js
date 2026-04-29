const API_URL = "http://127.0.0.1:8000/api"; // Убрали слэш здесь
const TOKEN_KEY = "auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    // В Django TokenAuth используется префикс "Token"
    headers.Authorization = `Token ${token}`;
  }

  // Теперь будет: http://127.0.0.1:8000/api + /auth/login/
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw data || { detail: "Ошибка запроса." };
  }

  return data;
}