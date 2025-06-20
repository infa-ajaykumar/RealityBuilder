# Real Estate Aggregator Backend

## Overview

This backend system is designed to aggregate real estate listings from various sources. It consists of several microservices that handle scraping, data processing, storage, and an API for accessing the processed data. The entire system is orchestrated using Docker Compose for ease of local development and deployment.

## Prerequisites

To run this system locally, you will need:
- Docker: [Install Docker](https://docs.docker.com/get-docker/)
- Docker Compose: [Install Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Services

The `docker-compose.yml` file defines the following services:

-   **`rabbitmq_server` (`rabbitmq`)**:
    -   Purpose: Message queue (RabbitMQ) for buffering raw scraped data from scraper workers.
    -   Image: `rabbitmq:3-management-alpine`
-   **`postgres_db_container` (`postgres_db`)**:
    -   Purpose: PostgreSQL database with PostGIS extension for structured storage of processed property listings.
    -   Image: `postgis/postgis:15-3.3`
-   **`elasticsearch_db_container` (`elasticsearch_db`)**:
    -   Purpose: Elasticsearch for providing advanced search and filtering capabilities on property listings.
    -   Image: `elasticsearch:8.11.0`
-   **`craigslist_scraper_worker` (`craigslist_scraper`)**:
    -   Purpose: Python worker that (currently) reads from a mock HTML file, parses property data, and sends it to the `rabbitmq` queue.
    -   Build context: `./scraper_workers/craigslist_scraper`
-   **`data_processing_service` (`data_processing`)**:
    -   Purpose: Node.js/TypeScript service that consumes raw data from `rabbitmq`, normalizes it, and then stores it in both `postgres_db` and `elasticsearch_db`.
    -   Build context: `./data_processing`
-   **`api_service_node` (`api_service`)**:
    -   Purpose: Node.js/Express/TypeScript API service that exposes endpoints to query property data stored in `postgres_db`.
    -   Build context: `./api_service`

## Environment Variables

Most service configurations (like connection URLs between services) are handled via environment variables within the `docker-compose.yml` file. These are pre-configured for the internal Docker network.

Key default credentials and settings (visible in `docker-compose.yml`):
-   **RabbitMQ**:
    -   User: `user`
    -   Password: `password`
-   **PostgreSQL**:
    -   User: `user`
    -   Password: `password`
    -   Database: `real_estate_db`
-   **API Service Port**: Default `3000` (configurable via `PORT` env var for the service)

**Note:** For a production environment, these credentials and configurations should be managed securely (e.g., using Docker secrets, environment-specific configuration files, or a secrets management tool) and not hardcoded or left as defaults.

## Running the System

1.  **Build and Start Services:**
    To build the images (if they don't exist or if code has changed) and start all services in detached mode (run in the background):
    ```bash
    docker-compose up --build -d
    ```
    If you want to see the logs directly in your terminal (attached mode):
    ```bash
    docker-compose up --build
    ```

2.  **Stop Services:**
    To stop all running services:
    ```bash
    docker-compose down
    ```
    To stop and remove volumes (e.g., to clear all data):
    ```bash
    docker-compose down -v
    ```

3.  **View Logs:**
    To view logs from all services:
    ```bash
    docker-compose logs -f
    ```
    To view logs for a specific service:
    ```bash
    docker-compose logs -f <service_name>
    # Example: docker-compose logs -f api_service_node
    # Example: docker-compose logs -f craigslist_scraper_worker
    ```

## Accessing Services

Once the system is running, you can access the services at the following default local ports:

-   **RabbitMQ Management UI**:
    -   URL: `http://localhost:15672`
    -   Credentials: `user` / `password`
-   **API Service (`api_service_node`)**:
    -   Example Endpoint: `http://localhost:3000/properties`
    -   Paginated: `http://localhost:3000/properties?page=1&limit=5`
-   **PostgreSQL (`postgres_db_container`)**:
    -   Host: `localhost`
    -   Port: `5432`
    -   User: `user`
    -   Password: `password`
    -   Database: `real_estate_db`
    -   (You can use a tool like `psql` or a GUI like DBeaver/pgAdmin to connect)
-   **Elasticsearch (`elasticsearch_db_container`)**:
    -   URL: `http://localhost:9200`
    -   Example to check indices: `http://localhost:9200/_cat/indices?v`

## Workflow Overview

The basic data flow in this system is as follows:

1.  The **`craigslist_scraper`** worker fetches (mock) property data.
2.  This raw data is published as messages to a queue in **`rabbitmq`**.
3.  The **`data_processing`** service consumes these messages from RabbitMQ.
4.  It then normalizes the data (e.g., cleans up fields, converts types) and stores it in the **`postgres_db`** for relational storage and indexes it in **`elasticsearch_db`** for searching.
5.  The **`api_service`** provides HTTP endpoints (e.g., `/properties`) to query and retrieve the processed property data from **`postgres_db`**.

## Further Development

-   To develop a specific service, you can modify its code and then rebuild that service's image using `docker-compose build <service_name>` followed by `docker-compose up -d <service_name>` to restart it.
-   The scraper can be expanded to fetch data from actual websites.
-   More sophisticated data processing, validation, and enrichment can be added to the `data_processing` service.
-   The `api_service` can be enhanced with more filtering options, search capabilities (integrating with Elasticsearch), and more robust error handling.
-   The `init.sql` file in `backend/database_setup` can be expanded to include more tables or refine the existing schema.
-   Consider adding linters, formatters, and unit/integration tests for each service.
