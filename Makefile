#!/usr/bin/make

# Explicitly define targets that might conflict with directories or need to always run
.PHONY: tests trust-cert restart

########################
# High-level Commands
########################
# Default setup: uses migrations + seeders (recommended for most developers)
#
# Order matters:
#   1. clear-mysql-data     - Remove old data so MySQL init scripts run on fresh volume
#   2. build-api            - Rebuild API image to pick up base image changes
#   3. composer-install     - Install deps (runs with --no-deps to avoid needing services)
#   4. up                   - Start services (MySQL creates marker file when ready)
#   5. Everything else      - Key gen, migrations, seeding (includes admin user), etc.
setup: clear-mysql-data build-api composer-install up trust-cert laravel-key-gen laravel-migrate-fresh-seed laravel-opensearch-sync setup-complete

# Setup with production data dump (for debugging prod issues or when seeders are incomplete)
# Requires: ./docker/local/db_import.sql (ask a teammate for a DB snapshot)
#
# Order matters:
#   1. clear-mysql-data     - Remove old data so MySQL imports the dump fresh
#   2. build-api            - Rebuild API image to pick up base image changes
#   3. build-mysql          - Rebuild image to include updated db_import.sql
#   4. composer-install     - Install deps (runs with --no-deps to avoid needing services)
#   5. up                   - Start services (MySQL imports dump, creates marker file when done)
#   6. Everything else      - Key gen, admin user (prod passwords are unknown), etc.
setup-with-dump: clear-mysql-data build-api build-mysql composer-install up trust-cert laravel-key-gen laravel-seed-admin laravel-create-oauth-keys laravel-opensearch-sync setup-complete-dump

########################
# Docker Commands
########################

# Authenticate Docker with AWS ECR (required to pull base image)
# Uses granted/assume for AWS SSO authentication (opens browser if session expired)
#
# Production (255096020299) - Released images, used by default in Dockerfile
# Development (919928213567) - PR images, for testing unreleased docker-laravel changes
ecr-login:
	. assume --exec -- aws ecr get-login-password --region us-east-2 | \
		docker login --username AWS --password-stdin 255096020299.dkr.ecr.us-east-2.amazonaws.com

ecr-login-dev:
	. assume --exec -- aws ecr get-login-password --region us-east-2 | \
		docker login --username AWS --password-stdin 919928213567.dkr.ecr.us-east-2.amazonaws.com

# Export AWS SSO session credentials to .env.aws for the local container
# Prompts you to pick an AWS SSO role (e.g. ReadOnly, PowerUser)
# Re-run when your SSO session expires (typically after 1 hour)
aws-creds:
	. assume --exec -- env | grep '^AWS_' > .env.aws
	@echo "AWS credentials written to .env.aws"
	$(MAKE) restart

up:
	docker compose up -d --wait --remove-orphans
restart:
	docker compose up -d
down:
	docker compose down
logs:
	docker compose logs -f
ssh:
	docker compose exec api /bin/bash

# Rebuild the API image (picks up base image changes from ECR)
build-api:
	@$(MAKE) ecr-login
	docker compose build api

# Rebuild the MySQL image (needed after updating db_import.sql)
build-mysql:
	docker compose build mysql

# Remove mysql volume and image to force re-initialization from db_import.sql
clear-mysql-data:
	docker compose down && docker image rm liv-app-backend-mysql:latest 2>/dev/null || true && docker volume rm liv-app-backend_mysql_data 2>/dev/null || true

########################
# Composer Commands
########################
# Note: composer install triggers package:discover which boots Laravel.
# `docker compose run` starts dependent services (mysql, redis, opensearch) automatically
# via depends_on, so this works even before `up` is called.
# --ignore-platform-req=ext-gd: phpoffice/phpspreadsheet and simplesoftwareio/simple-qrcode
# hard-require ext-gd in composer.json, but our code never uses GD at runtime.
# See: https://github.com/PHPOffice/PhpSpreadsheet/issues/367
composer-install:
	docker compose run --rm -w /var/www/html api composer install --ignore-platform-req=ext-gd

########################
# Laravel Commands
########################

laravel-key-gen:
	docker compose exec api php artisan key:generate

laravel-migrate:
	docker compose exec api php artisan migrate

laravel-migrate-fresh:
	@echo "Clearing OpenSearch indices..."
	docker compose exec opensearch curl -s -X DELETE "localhost:9200/_all" > /dev/null || true
	docker compose exec api php artisan migrate:fresh --drop-views

laravel-seed:
	docker compose exec api php artisan db:seed
	$(MAKE) laravel-create-oauth-keys
	$(MAKE) laravel-opensearch-sync

# Seed only the admin user (for dump-based setup where other data comes from dump)
laravel-seed-admin:
	docker compose exec api php artisan db:seed --class=AdminUserSeeder

laravel-migrate-fresh-seed:
	$(MAKE) laravel-migrate-fresh
	$(MAKE) laravel-seed
	$(MAKE) laravel-opensearch-sync

# Dump current schema to database/schema/mysql-schema.sql for faster migrate:fresh.
# Run after `make laravel-migrate-fresh` so views and seeder data are excluded.
# Re-run periodically (every few months) as new migrations accumulate.
# Requires docker-laravel with MySQL client (not MariaDB).
laravel-schema-dump:
	docker compose exec api php artisan schema:dump

tinker:
	docker compose exec api php artisan tinker

# Passport is used for facilitating OAuth requests
# creating keys for it enables that behavior.
# --force is used to make this comment idempotent
# Note, running this will invalidate OAuth tokens already created.
laravel-create-oauth-keys:
	docker compose exec api php artisan passport:keys --force
	docker compose exec api php artisan passport:client --personal --name="LIV Personal Access Client" --no-interaction

# OpenSearch provides fast full-text search and filtering
# syncing populates indices with existing data from MySQL
laravel-opensearch-sync:
	docker compose exec api php -d memory_limit=-1 artisan opensearch:sync
	docker compose exec api php -d memory_limit=-1 artisan opensearch:sync-premises-scheduled

# Clear all Laravel caches to resolve unexpected errors
laravel-cache-clear:
	docker compose exec api php artisan config:clear
	docker compose exec api php artisan cache:clear
	docker compose exec api php artisan route:clear
	docker compose exec api php artisan view:clear

########################
# Code Quality Commands
########################
# Check code style
pint:
	docker compose exec api composer run pint

# Check without fixing (dry-run)
pint-test:
	docker compose exec -T api composer run lint

########################
# HTTPS/TLS Commands
########################
# Trust the FrankenPHP/Caddy root CA on macOS (one-time setup for HTTPS)
# Requires: services must be running (run `make up` first)
trust-cert:
	@echo "Extracting Caddy root CA from container..."
	docker compose exec api cat /data/caddy/pki/authorities/local/root.crt > /tmp/caddy-root-ca.crt
	@echo "Adding to macOS Keychain (requires sudo)..."
	sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/caddy-root-ca.crt
	rm /tmp/caddy-root-ca.crt
	@echo "Done! Restart your browser to use https://localhost:8443"

########################
# PHPUnit Commands
########################
test:
	docker compose exec -e XDEBUG_MODE=off api php artisan test --parallel
test-coverage:
	docker compose exec -e XDEBUG_MODE=coverage api ./vendor/bin/phpunit --coverage-html tests/coverage

########################
# Setup Complete Messages
########################
setup-complete:
	@echo ""
	@echo "=========================================="
	@echo "  Setup complete!"
	@echo "=========================================="
	@echo ""
	@echo "  Dashboard: https://localhost:8443/web/login"
	@echo "  API Base:  https://localhost:8443/api/v1"
	@echo ""
	@echo "  Seeded users (password: Password123!):"
	@echo "    admin@test.local  — Super Admin"
	@echo "    alice@test.local  — Inspection Company"
	@echo ""

setup-complete-dump:
	@echo ""
	@echo "=========================================="
	@echo "  Setup complete!"
	@echo "=========================================="
	@echo ""
	@echo "  Dashboard: https://localhost:8443/web/login"
	@echo "  API Base:  https://localhost:8443/api/v1"
	@echo ""
	@echo "  Login: admin@test.local / Password123!"
	@echo "  (dump-based setup — only admin user is seeded)"
	@echo ""
