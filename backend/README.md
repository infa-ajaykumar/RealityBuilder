# Real Estate Aggregator Backend

## Configuration

Before running the system, you need to set up your local environment configuration. This project uses a `.env` file to manage environment-specific variables.

1.  **Copy the Example Configuration:**
    In the `backend` directory (where this README is located), you'll find a file named `.env.example`. Copy this file to a new file named `.env` in the same `backend` directory:
    ```bash
    cp .env.example .env
    ```

2.  **Customize Variables:**
    Open the newly created `.env` file with a text editor. Review and customize the variables as needed for your local setup. This file includes configurations for database credentials, API ports, external service API keys (if any), proxy settings, and other operational parameters. Default values are provided for most settings suitable for local development using Docker Compose.

    Docker Compose automatically loads variables from the `.env` file located in the directory where the `docker-compose up` command is executed.

## Overview

This backend system is designed to aggregate real estate listings from various sources. It consists of several microservices that handle scraping, data processing, storage, and an API for accessing the processed data. The entire system is orchestrated using Docker Compose for ease of local development and deployment.

Key features include:
- Multiple scraper implementations (basic Python, advanced Node.js/Puppeteer).
- Message queue (RabbitMQ) for decoupling scrapers from data processing.
- Data storage in PostgreSQL (with PostGIS extension).
- Search and aggregation capabilities via Elasticsearch.
- A RESTful API service with features like pagination, filtering, sorting, caching, and rate limiting.
- Scheduled scraping tasks via a cron-based scheduler.
- Basic deduplication and proxy rotation mechanisms.

## Prerequisites

To run this system locally, you will need:
- Docker: [Install Docker](https://docs.docker.com/get-docker/)
- Docker Compose: [Install Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)
- Node.js and npm: If you wish to run unit tests directly on your host machine (optional, as they can also be run within Docker).

## Services

The `docker-compose.yml` file defines the following services:

-   **`rabbitmq_server` (`rabbitmq`)**: Message queue (RabbitMQ) for buffering raw scraped data.
-   **`postgres_db_container` (`postgres_db`)**: PostgreSQL database with PostGIS for structured storage.
-   **`elasticsearch_db_container` (`elasticsearch_db`)**: Elasticsearch for search, filtering, and aggregations.
-   **`redis_cache_service` (`redis_cache`)**: Redis for API response caching and rate limiting.
-   **`craigslist_scraper_worker` (`craigslist_scraper`)**: Python worker for scraping (currently mock data).
-   **`advanced_scraper_puppeteer_service` (`advanced_scraper_puppeteer`)**: Node.js/Puppeteer worker for scraping dynamic websites.
-   **`data_processing_service` (`data_processing`)**: Node.js/TypeScript service for consuming from RabbitMQ, normalizing data, geocoding, performing deduplication, and storing in databases.
-   **`api_service_node` (`api_service`)**: Node.js/Express API to serve property data with advanced query features.
-   **`scheduler_service` (`scheduler`)**: Cron-based service to trigger scraping tasks periodically.

## Environment Variables

Most service configurations are handled via environment variables, defined in your `.env` file (created from `.env.example`). Key categories include:
-   Database credentials (PostgreSQL, RabbitMQ).
-   Connection URLs for services (Redis, Elasticsearch).
-   API service settings (port, cache TTLs, rate limit parameters).
-   Scraper configurations (target URLs, proxy settings via `HTTP_PROXIES`).
-   Data processing settings (geocoding provider, deduplication thresholds).

Refer to the `.env.example` file for a detailed list and default values.

**Note:** For a production environment, sensitive credentials should be managed securely (e.g., Docker secrets, HashiCorp Vault) and not stored in plain `.env` files within the repository.

## Running the System

1.  **Initial Setup:**
    - Ensure Docker and Docker Compose are running.
    - Create and configure your `backend/.env` file from `backend/.env.example` as described in the "Configuration" section.

2.  **Build and Start Services (Local Development):**
    Navigate to the `backend` directory and run:
    ```bash
    docker-compose up --build -d
    ```
    This command builds the images (if not already built or if code has changed) and starts all services in detached mode.
    To view logs from all services:
    ```bash
    docker-compose logs -f
    ```
    To view logs for a specific service:
    ```bash
    docker-compose logs -f <service_name>
    # e.g., docker-compose logs -f api_service_node
    ```

3.  **Stopping Services:**
    To stop all running services:
    ```bash
    docker-compose down
    ```
    To stop and remove volumes (clearing all data):
    ```bash
    docker-compose down -v
    ```

## Accessing Services

Once the system is running, services can be accessed (ports might be restricted in `docker-compose.prod.yml`):
-   **API Service**: `http://localhost:3000`
    -   Example: `GET http://localhost:3000/properties`
    -   Example: `GET http://localhost:3000/properties/filters/metadata`
    -   Supports pagination, filtering (location, price, type, beds, baths, area, amenities), sorting, caching, and rate limiting.
-   **RabbitMQ Management UI**: `http://localhost:15672` (Credentials: `user`/`password` as per `.env`).
-   **PostgreSQL**: Connect via `localhost:5432` (Credentials and DB name as per `.env`).
-   **Elasticsearch**: `http://localhost:9200` (e.g., `http://localhost:9200/_cat/indices?v`).
-   **Redis**: Connect via `localhost:6379`.

## Scrapers and Scheduler

-   **Scrapers (`craigslist_scraper`, `advanced_scraper_puppeteer`):**
    -   These services are designed to be run as tasks.
    -   They can be triggered manually:
        ```bash
        docker-compose run --rm craigslist_scraper
        docker-compose run --rm advanced_scraper_puppeteer
        ```
    -   Proxy configuration via `HTTP_PROXIES` in `.env` is supported.
-   **Scheduler (`scheduler_service`):**
    -   This service runs cron jobs defined in `backend/scheduler/crontab`.
    -   By default, it's configured to trigger the scrapers periodically. You can modify the `crontab` file to change schedules.
    -   **Security Note:** The scheduler mounts the Docker socket (`/var/run/docker.sock`) to execute `docker-compose` commands. This grants broad control over the Docker daemon and should be used with caution, especially in shared or production environments.

## Running Unit Tests

Unit tests are implemented using Jest for the `api_service` and `data_processing` services.

**1. Running tests via Docker Compose (Recommended for consistency):**
This method ensures tests run in the same environment as the application containers.
```bash
# For API service
docker-compose run --rm api_service_node npm test

# For Data Processing service
docker-compose run --rm data_processing_service npm test
```
*(Note: `api_service_node` and `data_processing_service` are the `container_name`s. If you use service names from `docker-compose.yml` like `api_service`, ensure they are distinct or use the container names).*
The provided solution uses `api_service` and `data_processing` as service names, which should work with `docker-compose run --rm <service_name> npm test`.

**2. Running tests locally on your host machine (Requires Node.js & npm):**
```bash
# For API service
cd backend/api_service
# npm install # Run if you haven't installed dependencies locally
npm test

# For Data Processing service
cd backend/data_processing
# npm install # Run if you haven't installed dependencies locally
npm test
```
Make sure to navigate back to the main `backend` directory to run `docker-compose` commands.

## Production-like Deployment

For a more production-oriented setup, a `docker-compose.prod.yml` override file is provided.

**Key changes in `docker-compose.prod.yml` include:**
-   Sets `NODE_ENV=production` for Node.js services.
-   Ensures Puppeteer runs in headless mode.
-   Adjusts `restart` policies for services.
-   Modifies port mappings for databases and message queues (e.g., binding to `127.0.0.1`) for security.

**To run with production overrides:**
Use both the base and the production override file:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
To stop services started this way:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

**Important Production Considerations:**
-   **Secrets Management:** Use Docker Secrets, HashiCorp Vault, or cloud provider solutions for sensitive data.
-   **Managed Services:** Consider managed cloud services for databases, message queues, etc., for scalability and reliability.
-   **Orchestration:** For complex deployments, use Kubernetes or similar platforms.
-   **Security:** Secure your Docker host, configure firewalls, and control access strictly.
-   **Backups:** Implement robust backup strategies for persistent data.
-   **Logging & Monitoring:** Use centralized logging and monitoring tools.

## Known Limitations & Future Work
-   **Property Type Filtering:** The API's property type filter currently uses a placeholder field (`source_name.keyword`). This should be updated to use a dedicated, normalized `property_type` field once it's consistently populated by the data processing pipeline.
-   **Deduplication Logic:** The current deduplication is basic (marks as potential duplicate). More advanced strategies like data merging or more sophisticated scoring could be implemented.
-   **Proxy Rotation:** Proxy selection is random per scraper run (Python) or per scraper instance start (Puppeteer). More dynamic rotation or error-based rotation per request could be added.
-   **Error Handling:** While basic error handling is in place, it can be made more robust across all services.
-   **Real Scrapers:** The `craigslist_scraper` uses mock HTML. Both scrapers would need to be adapted with specific selectors and logic for real target websites.
-   **Scalability:** For high-volume scraping or API traffic, individual services might need scaling, and message queue/database configurations might need tuning.

## Further Development

-   Develop a frontend application to consume the API.
-   Expand scraper capabilities to more websites and data points.
-   Implement user accounts and authentication for the API.
-   Add more sophisticated analytics and reporting features.
-   Refine the UI/UX for presenting aggregated property data.
-   Consider adding a UI for managing scheduled tasks or viewing scraper statuses.
