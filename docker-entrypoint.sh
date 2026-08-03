#!/bin/sh
set -e

# Apply any pending migrations against the configured database.
echo "Running database migrations…"
npx prisma migrate deploy

# Optionally seed demo data (admin/parent/sitter accounts). Off by default;
# set SEED_ON_START=true (see docker-compose.yml) to enable for a fresh dev DB.
if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding demo data…"
  npm run db:seed
fi

echo "Starting Sitbaby on port 3000…"
exec npm run start
