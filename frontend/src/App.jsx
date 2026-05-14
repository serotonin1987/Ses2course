import { useEffect, useState } from "react";
import { apiRequest, clearToken, getToken, setToken } from "./api";
import logoDark from "./assets/logo-fintracker-dark-v2.png";

const emptyForm = { username: "", email: "", password: "" };



function getErrorText(error) {
  if (!error) return "Произошла неизвестная ошибка.";
  if (typeof error === "string") return error;
  if (error.detail) return error.detail;
  const firstKey = Object.keys(error)[0];
  const firstValue = error[firstKey];
  if (Array.isArray(firstValue)) return `${firstKey}: ${firstValue[0]}`;
  return "Что-то пошло не так.";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "error", duration = 4000) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, duration);
  }
  

  // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ MVP ---
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);

  // Загрузка данных трекера
  async function loadDashboardData() {
    try {
      // Пути должны быть настроены в Django (views.py)
      const txData = await apiRequest("/transactions/");
      const goalsData = await apiRequest("/goals/");
      setTransactions(txData);
      setGoals(goalsData);
    } catch (e) {
      console.error("Ошибка загрузки данных трекера", e);
    }
  }
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem("theme") === "dark");
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);
  
  useEffect(() => {
    if (!getToken()) return;
    apiRequest("/auth/me/")
      .then((userData) => {
        setUser(userData);
        loadDashboardData(); // Загружаем данные сразу после проверки юзера
      })
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  function openAuth(nextMode) {
    setMode(nextMode);
    setForm(emptyForm);
    setError("");
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    // clear per-field error when user edits
    setFieldErrors((prev) => {
      if (!prev || !prev[name]) return prev;
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  }

  async function submitAuth(event) {
    event.preventDefault();
    // custom validation: disable native tooltips and show our styled messages
    const formEl = event.target;
    // reset field errors
    setFieldErrors({});
    if (!formEl.checkValidity()) {
      // collect per-field messages
      const newErrors = {};
      Array.from(formEl.elements).forEach((el) => {
        if (el.name && el.tagName === "INPUT") {
          if (!el.checkValidity()) newErrors[el.name] = el.validationMessage || "Заполните это поле.";
        }
      });
      setFieldErrors(newErrors);
      return;
    }

    setLoading(true);
    setError("");
    const path = mode === "register" ? "/auth/register/" : "/auth/login/";
    const payload = mode === "register" ? form : { username: form.username, password: form.password };

    try {
      const data = await apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
      setToken(data.token);
      setUser(data.user);
      setMode(null);
      loadDashboardData(); // Загружаем данные после успешного входа
    } catch (authError) {
      const msg = getErrorText(authError);
      // show as bottom toast
      showToast(msg, "error", 4500);
      // still set error state for legacy usage if needed
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try { await apiRequest("/auth/logout/", { method: "POST" }); } 
    catch (e) {} 
    finally { clearToken(); setUser(null); setTransactions([]); setGoals([]); }
  }

  // Расчет баланса для карточки
  const totalBalance = transactions.reduce((acc, t) => acc + (t.type === 'income' ? +t.amount : -t.amount), 0);

  return (
    <div className="app-container">
      <header className="header">
        <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
          {isDarkMode ? "☀️ Светло" : "🌙 Темно"}
        </button>
        <a className="brand-logo-link" href="/">
          <img src={logoDark} alt="FinTracker" className="brand-logo-image" />
          <span className="brand-text">FinTracker</span>
        </a>
        <div className="auth">
          {user ? (
            <>
              <span className="username">Привет, {user.username}</span>
              <button className="btn-secondary" onClick={logout}>Выйти</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => openAuth("login")}>Войти</button>
              <button className="btn-ghost" onClick={() => openAuth("register")}>Регистрация</button>
            </>
          )}
        </div>
      </header>

      {mode && (
        <div className="modal-overlay">
          <form className="auth-panel" onSubmit={submitAuth} noValidate>
            <h2>{mode === "register" ? "Создать аккаунт" : "С возвращением"}</h2>
            <div className="field-tooltip">
              <input name="username" placeholder="Логин" value={form.username} onChange={updateField} required />
              {fieldErrors.username && <div className="tooltip-box">{fieldErrors.username}</div>}
            </div>
            {mode === "register" && (
              <div className="field-tooltip">
                <input name="email" placeholder="Email" type="email" value={form.email} onChange={updateField} required />
                {fieldErrors.email && <div className="tooltip-box">{fieldErrors.email}</div>}
              </div>
            )}
            <div className="field-tooltip">
              <input name="password" placeholder="Пароль" type="password" value={form.password} onChange={updateField} required />
              {fieldErrors.password && <div className="tooltip-box">{fieldErrors.password}</div>}
            </div>
            {error && <p className="error-message">{error}</p>}
            <div className="auth-actions">
              <button type="button" className="btn-cancel" onClick={() => setMode(null)}>Отмена</button>
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
            <button className="btn-main" onClick={() => openAuth("register")}>Начать использование</button>
          </section>
        )}

        {user && (
          <div className="dashboard">
            <div className="stats-grid">
              {/* КАРТОЧКА 1: БАЛАНС */}
              <div className="card stat-card balance">
                <span className="label">Общий баланс</span>
                <h2 className="value">{totalBalance.toLocaleString()} ₸</h2>
              </div>

              {/* КАРТОЧКА 2: ЦЕЛЬ (Копилка) */}
              {goals.length > 0 ? (
                <div className="card stat-card goal">
                  <span className="label">Цель: {goals[0].title}</span>
                  <div className="progress-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${Math.min((goals[0].current_amount / goals[0].target_amount) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="goal-info">
                    {goals[0].current_amount.toLocaleString()} / {goals[0].target_amount.toLocaleString()} ₸
                  </span>
                </div>
              ) : (
                <div className="card stat-card empty">
                  <p>У вас пока нет активных целей</p>
                  <button className="btn-secondary">Создать цель</button>
                </div>
              )}
            </div>

            {/* КАРТОЧКА 3: ПОСЛЕДНИЕ ТРАТЫ */}
            <div className="card list-card">
              <h3>Последние операции</h3>
              <div className="transaction-list">
                {transactions.length > 0 ? (
                  transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="transaction-item">
                      <span>{t.category}</span>
                      <span className={t.type === 'expense' ? 'minus' : 'plus'}>
                        {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()} ₸
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="empty-text">Операций пока нет</p>
                )}
              </div>
              <button className="btn-ghost">+ Добавить трату</button>
            </div>
          </div>
        )}
      </main>
      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}