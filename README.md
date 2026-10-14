#IMPORTANT
THIS REPOSITORY IS FOR ARCHIVAL PURPOSE ONLY AS PER ARCHITECUTRAL REQUIREMENT MOST OF THE IMAGE HANDLING OPERATION AND DIEASE PREDICTION WILL BE DONE ON A SEPERATE SEVER WHICH IS NOT INCLUDE HERE AS IT CONTAIN STUFF THAT IS HOMEBREW BY MY PROFESSORS/SEINORS AT VNUA AND I DON'T HAVE THE PERMISSION TO SHARE IT SOOO YEAH 

# WheatDB

WheatDB is a web application for managing a wheat disease reference database and its images. Users can browse disease information and image galleries, while authorized contributors can add or maintain records. The app also includes account and role management, discussions, an activity log, and a separate rice leaf image prediction feature.

## Project structure

| Directory | Purpose 
| --- | --- | --- |
| `frontend/` | React 19 interface served by Vite |
| `backend/` | Django REST API, user accounts, disease records, discussions, and metadata|


## Features

- Register, sign in, reset passwords with a one-time code, and manage user profiles.
- Browse and maintain wheat disease entries and their labeled images.
- Upload unlabeled or healthy images, organize the image library, and update labels.
- Participate in discussion threads and review the changelog.
- Run rice leaf disease predictions and view the model's top results.
- Use roles (`user`, `helper`, `expert`, and `admin`) for permission-controlled actions.

## Requirements

- Python 3.12 or newer for the Django 6 main API.
- Node.js and npm for the Vite frontend.
- PostgreSQL, with a database and user created for the main API.
- PyTorch, torchvision, and Pillow in the Python environment used for `predict_backend`.

There are no checked-in Python requirements files at the moment. Install the Django packages used by each service in your Python environment. The main API also needs Django REST Framework, SimpleJWT, django-cors-headers, python-dotenv, and a PostgreSQL driver such as psycopg. The image service needs Django. The prediction service needs Django, PyTorch, torchvision, and Pillow.

## Configure the main API

Create `backend/.env` with the connection details for your PostgreSQL database:

```dotenv
DB_NAME=wheatdb
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=127.0.0.1
DB_PORT=5432

# Optional: defaults shown here are suitable only for local development.
IMAGE_BACKEND_BASE_URL=http://127.0.0.1:8081
PREDICT_BACKEND_BASE_URL=http://127.0.0.1:8010
```

The app loads this file with `python-dotenv`. Do not commit real credentials. Password reset email uses Django's console email backend unless SMTP settings are configured; in the default development setup, reset codes appear in the backend terminal.

## API overview

The main API is rooted at `/api/`. Common route groups include:

- `/api/auth/` — CSRF, registration, login/logout, current user, token refresh, and password reset.
- `/api/wheat-diseases/` — disease entries and their images.
- `/api/images/` — image library, uploads, moves, and bulk deletion.
- `/api/users/` and `/api/user/` — user lists, roles, profiles, and avatars.
- `/api/discussions/` — discussion threads and posts.
- `/api/changelog/` — activity log.
- `/api/predict/` — prediction endpoint proxied through the main backend to the prediction service.

Most API views require authentication by default. Registration and login are available without an existing account; individual view permissions control contributor and administrative actions. Authentication uses HTTP-only JWT cookies and CSRF protection.

The image service exposes `GET /` as a health check, `POST /uploads`, `GET /stored/<path>`, and `DELETE /stored/<path>`. Its remote image proxy is available at `/images/<path>`. Write requests can be protected with `Authorization: Bearer <key>` or `X-API-Key` when `IMAGE_BACKEND_API_KEY` is configured.

## Useful commands

```powershell
# Frontend production build and lint
cd frontend
npm run build
npm run lint

# Django checks (run from the relevant service directory)
python manage.py check
```

## Notes

- The frontend is configured for local development origins, and the Django settings include development defaults. Review secrets, allowed hosts, CORS/CSRF, HTTPS cookies, and debug settings before exposing services publicly.
- `image_backend/README.md` and `predict_backend/README.md` contain additional service-specific endpoint and configuration notes.
- The image service's uploaded files and SQLite database, the main PostgreSQL database, and the trained model are separate data assets; back them up independently.
