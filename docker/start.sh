#!/bin/sh
set -e

echo "Starting SafeRide monolith..."

# Start all Node.js services via PM2
pm2 start /app/pm2.config.js --no-daemon &

# Give services time to start before nginx begins accepting traffic
echo "Waiting for services to initialize..."
sleep 5

# Start nginx in foreground (keeps container alive)
echo "Starting nginx..."
exec nginx -g 'daemon off;'
