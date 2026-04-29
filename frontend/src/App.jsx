import { useEffect, useState } from "react";
import { apiRequest, clearToken, getToken, setToken } from "./api";



const emptyForm = {
  username: "",
  email: "",
  password: "",
};

function getErrorText(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.detail) {
    return error.detail;
  }

  const firstKey = Object.keys(error)[0];
  const firstValue = error[firstKey];
  if (Array.isArray(firstValue)) {
    return `${firstKey}: ${firstValue[0]}`;
  }

  return "Что-то пошло не так.";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      return;
    }

    apiRequest("/auth/me/")
      .then(setUser)
      .catch(() => clearToken());
  }, []);

  function openAuth(nextMode) {
    setMode(nextMode);
    setForm(emptyForm);
    setError("");
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const path = mode === "register" ? "/auth/register/" : "/auth/login/";
    const payload =
      mode === "register"
        ? form
        : { username: form.username, password: form.password };

    try {
      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(data.token);
      setUser(data.user);
      setMode(null);
      setForm(emptyForm);
    } catch (authError) {
      setError(getErrorText(authError));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout/", { method: "POST" });
    } finally {
      clearToken();
      setUser(null);
      setMode(null);
    }
  }

  return (
    <>
      <header className="header">
        <a className="brand" href="/">
          Template
        </a>

        <div className="auth">
          {user ? (
            <>
              <span className="username">{user.username}</span>
              <button type="button" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => openAuth("login")}>
                Войти
              </button>
              <button type="button" onClick={() => openAuth("register")}>
                Регистрация
              </button>
            </>
          )}
        </div>
      </header>

      {mode && (
        <form className="auth-panel" onSubmit={submitAuth}>
          <input
            name="username"
            placeholder="Логин"
            value={form.username}
            onChange={updateField}
            autoComplete="username"
            required
          />
          {mode === "register" && (
            <input
              name="email"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
            />
          )}
          <input
            name="password"
            placeholder="Пароль"
            type="password"
            value={form.password}
            onChange={updateField}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
          />
          {error && <p className="error">{error}</p>}
          <div className="auth-actions">
            <button type="button" onClick={() => setMode(null)}>
              Отмена
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "..." : mode === "register" ? "Создать" : "Войти"}
            </button>
          </div>
        </form>
      )}

      <main className="page" />
    </>
  );
}
