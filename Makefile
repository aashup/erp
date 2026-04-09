COMPOSE := PATH=/usr/local/bin:$$PATH /usr/local/bin/docker compose

.PHONY: start migrate seed pint logs backend-log frontend-log down

# ─────────────────────────────────────────────
# Start — build images and bring all services up
# Live-edits in ./api and ./fe take effect immediately (bind mounts)
# ─────────────────────────────────────────────
start:
	$(COMPOSE) up -d --build

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
migrate:
	$(COMPOSE) exec api php artisan migrate

seed:
	$(COMPOSE) exec api php artisan db:seed

# ─────────────────────────────────────────────
# Code Quality
# ─────────────────────────────────────────────
pint:
	$(COMPOSE) exec api ./vendor/bin/pint

# ─────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────
logs:
	$(COMPOSE) logs -f api fe

backend-log:
	$(COMPOSE) logs -f api

frontend-log:
	$(COMPOSE) logs -f fe

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
down:
	$(COMPOSE) down
