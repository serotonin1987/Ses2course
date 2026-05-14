import { useEffect, useState, useRef } from "react";
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
  const fieldTimers = useRef({});

  // durations (ms)
  const FIELD_VISIBLE_MS = 1500; // shorter display time requested
  const FIELD_FADE_MS = 300;
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "error", duration = 4000) {
    // dedupe: if same message exists, reset its timers instead of stacking
    setToasts((prev) => {
      // try find existing message
      const existing = prev.find((x) => x.message === message);
      if (existing) {
        // clear previous timers if present
        try { clearTimeout(existing._fadeTimer); } catch (e) {}
        try { clearTimeout(existing._removeTimer); } catch (e) {}

        const id = existing.id;
        // schedule fade then removal
        const fadeTimer = setTimeout(() => {
          setToasts((t) => t.map((x) => (x.id === id ? { ...x, fading: true } : x)));
        }, duration);
        const removeTimer = setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, duration + 500);

        return prev.map((x) => (x.id === id ? { ...x, type, fading: false, _fadeTimer: fadeTimer, _removeTimer: removeTimer } : x));
      }

      const id = Date.now() + Math.random();
      const fadeTimer = setTimeout(() => {
        setToasts((t) => t.map((x) => (x.id === id ? { ...x, fading: true } : x)));
      }, duration);
      const removeTimer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, duration + 500); // give 500ms for fade animation

      return [...prev, { id, message, type, fading: false, _fadeTimer: fadeTimer, _removeTimer: removeTimer }];
    });
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

  // disable header interactions while modal is open to avoid accidental navigation
  useEffect(() => {
    const headerEls = Array.from(document.querySelectorAll(".header a, .header button, .header [tabindex]"));
    if (mode) {
      document.body.classList.add("modal-open");
      // prevent background scroll
      document.body.style.overflow = "hidden";
      // make header elements unfocusable and mark hidden
      headerEls.forEach((el) => {
        const prevTab = el.getAttribute("tabindex");
        if (prevTab !== null) el.setAttribute("data-prev-tabindex", prevTab);
        el.setAttribute("data-prev-tabindex", prevTab === null ? "" : prevTab);
        el.setAttribute("tabindex", "-1");
        el.setAttribute("aria-hidden", "true");
      });
    } else {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      headerEls.forEach((el) => {
        const prev = el.getAttribute("data-prev-tabindex");
        if (prev === "" || prev === null) {
          el.removeAttribute("tabindex");
        } else {
          el.setAttribute("tabindex", prev);
        }
        el.removeAttribute("data-prev-tabindex");
        el.removeAttribute("aria-hidden");
      });
    }
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      headerEls.forEach((el) => {
        const prev = el.getAttribute("data-prev-tabindex");
        if (prev === "" || prev === null) {
          el.removeAttribute("tabindex");
        } else {
          el.setAttribute("tabindex", prev);
        }
        el.removeAttribute("data-prev-tabindex");
        el.removeAttribute("aria-hidden");
      });
    };
  }, [mode]);

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
    // reset field errors and clear any existing timers
    Object.values(fieldTimers.current).forEach((t) => clearTimeout(t));
    fieldTimers.current = {};
    setFieldErrors({});
    if (!formEl.checkValidity()) {
      // collect per-field messages and schedule auto-fade/removal
      const newErrors = {};
      Array.from(formEl.elements).forEach((el) => {
        if (el.name && el.tagName === "INPUT") {
          if (!el.checkValidity()) {
            const msg = el.validationMessage || "Заполните это поле.";
            newErrors[el.name] = { msg, fading: false };
          }
        }
      });
      // set errors then schedule timers
      setFieldErrors((prev) => ({ ...prev, ...newErrors }));
      Object.keys(newErrors).forEach((name) => {
        // clear existing timers for this field
        if (fieldTimers.current[name]) {
          clearTimeout(fieldTimers.current[name].fade);
          clearTimeout(fieldTimers.current[name].remove);
        }
        const fade = setTimeout(() => {
          setFieldErrors((prev) => prev[name] ? { ...prev, [name]: { ...prev[name], fading: true } } : prev);
        }, FIELD_VISIBLE_MS);
        const remove = setTimeout(() => {
          setFieldErrors((prev) => {
            if (!prev[name]) return prev;
            const copy = { ...prev };
            delete copy[name];
            return copy;
          });
          // clear timers
          if (fieldTimers.current[name]) {
            clearTimeout(fieldTimers.current[name].fade);
            clearTimeout(fieldTimers.current[name].remove);
            delete fieldTimers.current[name];
          }
        }, FIELD_VISIBLE_MS + FIELD_FADE_MS + 50);
        fieldTimers.current[name] = { fade, remove };
      });
      return;
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
            {/* inline top error removed: server errors will be shown as bottom toasts */}
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
          <div key={t.id} className={`toast toast-${t.type} ${t.fading ? "fade" : ""}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}