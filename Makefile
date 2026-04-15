COMPOSE := PATH=/usr/local/bin:$$PATH /usr/local/bin/docker compose

.PHONY: start rebuild rebuild-fe rebuild-be migrate seed pint logs backend-log frontend-log down

# ─────────────────────────────────────────────
# Start — build images and bring all services up
# Live-edits in ./api and ./fe take effect immediately (bind mounts)
# ─────────────────────────────────────────────
start:
	$(COMPOSE) up -d  

# ─────────────────────────────────────────────
# Rebuild — force-rebuild images, drop stale node_modules volume, restart
# ─────────────────────────────────────────────
rebuild:
	$(COMPOSE) rm -sf fe api
	docker volume rm erp_fe_node_modules 2>/dev/null || true
	$(COMPOSE) build --no-cache fe api
	$(COMPOSE) up -d

rebuild-fe:
	$(COMPOSE) rm -sf fe
	docker volume rm erp_fe_node_modules 2>/dev/null || true
	$(COMPOSE) build --no-cache fe
	$(COMPOSE) up -d fe

rebuild-be:
	$(COMPOSE) rm -sf api
	$(COMPOSE) build --no-cache api
	$(COMPOSE) up -d api

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
migrate:
	$(COMPOSE) exec api php artisan migrate

migrate-fresh:
	$(COMPOSE) exec api php artisan migrate:fresh

migrate-fresh-seed:
	$(COMPOSE) exec api php artisan migrate:fresh --seed

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
