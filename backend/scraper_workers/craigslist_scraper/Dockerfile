# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the requirements file into the container
COPY requirements.txt ./

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the mock HTML data file
COPY mock_listings.html ./

# Copy the rest of the application code
COPY scraper.py ./
# If there were other .py files, you could use COPY . .

# Define environment variable for Python output buffering
ENV PYTHONUNBUFFERED 1

# Environment variables for RabbitMQ will be injected by Docker Compose
# Example (can be set here as defaults if not provided by Docker Compose):
# ENV RABBITMQ_HOST=rabbitmq_server
# ENV RABBITMQ_QUEUE=property_listings_raw
# ENV RABBITMQ_USER=user
# ENV RABBITMQ_PASS=password

# Run scraper.py when the container launches
CMD ["python", "scraper.py"]
