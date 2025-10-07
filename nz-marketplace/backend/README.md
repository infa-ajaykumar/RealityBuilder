# NZ Marketplace - Backend

This directory contains the backend service for the NZ Marketplace application, built with Django and Django REST Framework.

## Setup

1.  **Navigate to the project root.**
2.  **Create a `.env` file** by copying the `.env.example` file: `cp .env.example .env`
3.  **Fill in the required environment variables** in the `.env` file.

## Running the service

You can run the backend service using Docker Compose from the project root:

```bash
docker-compose up --build backend
```

The backend will be available at `http://localhost:8000`.

## Running tests

To run the automated tests for the backend, you can use the following command:

```bash
docker-compose run --rm backend python manage.py test
```

## API Documentation

The API documentation is automatically generated using Swagger/OpenAPI and is available at the following endpoints when the service is running:

-   **Swagger UI:** `http://localhost:8000/swagger/`
-   **ReDoc:** `http://localhost:8000/redoc/`