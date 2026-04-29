import { useEffect, useState } from "react";
import { apiRequest, clearToken, getToken, setToken } from "./api";

// Начальное состояние формы
const emptyForm = {
  username: "",
  email: "",
  password: "",
};

// Функция для красивого вывода ошибок от Django
function getErrorText(error) {
  if (!error) return "Произошла неизвестная ошибка.";
  if (typeof error === "string") return error;
  if (error.detail) return error.detail;

  // Если Django вернул ошибки валидации (например, { "username": ["Обязательное поле"] })
  const firstKey = Object.keys(error)[0];
  const firstValue = error[firstKey];
  if (Array.isArray(firstValue)) {
    return `${firstKey}: ${firstValue[0]}`;
  }

  return "Что-то пошло не так.";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // null, "login" или "register"
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Проверка авторизации при загрузке страницы
  useEffect(() => {
    if (!getToken()) return;

    // Стучимся в /api/auth/me/ (префикс /api берется из api.js)
    apiRequest("/auth/me/")
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  // Открытие модалки
  function openAuth(nextMode) {
    setMode(nextMode);
    setForm(emptyForm);
    setError(""); 
    setShowPassword(false);
  }

  // Обновление полей формы
  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  // Отправка формы (Логин или Регистрация)
  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    // Пути должны строго совпадать с urls.py в Django
    const path = mode === "register" ? "/auth/register/" : "/auth/login/";
    const payload = mode === "register" 
      ? form 
      : { username: form.username, password: form.password };

    try {
      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setToken(data.token);
      setUser(data.user); // Убедись, что твой бэкенд возвращает объект user вместе с токеном
      setMode(null);
      setForm(emptyForm);
    } catch (authError) {
      console.error("Auth Error:", authError);
      setError(getErrorText(authError));
    } finally {
      setLoading(false);
    }
  }

  // Выход из системы
  async function logout() {
    try {
      // Django TokenAuth обычно не требует запроса на выход, но для порядка можно
      await apiRequest("/auth/logout/", { method: "POST" });
    } catch (e) {
      console.log("Logout request failed, cleaning up local storage anyway.");
    } finally {
      clearToken();
      setUser(null);
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <a className="brand" href="/">
          FinTracker
        </a>

        <div className="auth">
          {user ? (
            <>
              <span className="username">Привет, {user.username}</span>
              <button className="btn-secondary" type="button" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <button className="btn-dark" type="button" onClick={() => openAuth("login")}>
                Войти
              </button>
              <button className="btn-dark" type="button" onClick={() => openAuth("register")}>
                Регистрация
              </button>
            </>
          )}
        </div>
      </header>

      {/* Модальное окно авторизации */}
      {mode && (
        <div className="modal-overlay">
          <form className="auth-panel" onSubmit={submitAuth}>
            <h2>{mode === "register" ? "Создать аккаунт" : "С возвращением"}</h2>
            
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
                required
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

            {error && <p className="error-message">{error}</p>}

            <div className="auth-actions">
              <button type="button" className="btn-cancel" onClick={() => setMode(null)}>
                Отмена
              </button>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Загрузка..." : mode === "register" ? "Создать" : "Войти"}
              </button>
            </div>
          </form>
        </div>
      )}

      <main className="page">
        {!user && !mode && (
          <section className="hero">
            <h1>Управляйте финансами грамотно</h1>
            <p>Простой и удобный трекер ваших доходов и расходов.</p>
            <button className="btn-main" onClick={() => openAuth("register")}>
              Начать использование
            </button>
          </section>
        )}

        {user && (
          <div className="dashboard">
            <h2>Ваш личный кабинет</h2>
            <p>Здесь скоро появятся ваши транзакции и графики.</p>
          </div>
        )}
      </main>
      
    </div>
  );
}
