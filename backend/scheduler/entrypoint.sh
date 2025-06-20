#!/bin/sh

# Ensure the log file exists and has correct permissions for cron to write to
touch /var/log/cron_jobs.log
# chown root:root /var/log/cron_jobs.log # Or appropriate user if not running crond as root
# chmod 600 /var/log/cron_jobs.log      # Or 644

echo "Starting crond..."
# Start cron daemon in the foreground
# -f: foreground
# -l 8: log level (8 is debug, lower for less verbosity e.g., 5)
# -L /var/log/cron_jobs.log: direct crond output here (in addition to job outputs)
crond -f -l 8 -L /var/log/cron_jobs.log

# Note: crond -f will keep the container running.
# If crond is not run in foreground, you'd need something like:
# tail -f /var/log/cron_jobs.log
# or another command to keep the container alive.
# But with -f, crond itself is the foreground process.
echo "crond started. Container will remain active."
