# Using alpine as a base for a small image
FROM alpine:latest

# Install cron (dcron), docker CLI, and docker-compose
RUN apk add --no-cache dcron docker-cli docker-compose

# Create directory for crontab and application files
RUN mkdir -p /etc/cron.d /app /var/log
WORKDIR /app

# Copy crontab file into the cron directory
# dcron on Alpine reads files from /etc/cron.d/
# These files should be named without dots (e.g., 'scheduler')
# and their content should be in standard crontab format.
# The user field is typically not used in /etc/cron.d files for dcron as jobs run as root.
COPY crontab /etc/cron.d/scheduler-tasks
# Ensure crontab has correct permissions (though usually set by package manager)
RUN chmod 0644 /etc/cron.d/scheduler-tasks

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# CMD to run the entrypoint script which starts cron
CMD ["/app/entrypoint.sh"]
