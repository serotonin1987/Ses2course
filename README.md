# Django + React auth template

Пустой шаблон проекта: Django API, React frontend, регистрация, вход, выход и пустая главная страница с header.

## Запуск backend

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py runserver
```

Backend будет доступен на `http://127.0.0.1:8000`.

## Запуск frontend

В новом терминале:

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на `http://127.0.0.1:5173`.

Если backend будет на другом адресе, создай `frontend/.env` по примеру `frontend/.env.example`.

## API

- `POST /api/auth/register/` - регистрация
- `POST /api/auth/login/` - вход
- `POST /api/auth/logout/` - выход
- `GET /api/auth/me/` - текущий пользователь

Media уже настроены в `backend/backend/settings.py` и `backend/backend/urls.py`.
