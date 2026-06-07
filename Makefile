.PHONY: up down restart status logs health state frontend

up:
	@if [ ! -f .env ]; then cp .env.example .env; fi
	docker compose -f docker-compose-assignment.yaml up -d
	docker compose up --build -d
	@echo ""
	@echo "Waiting for services..."
	@sleep 5
	@echo ""
	@echo "Running containers:"
	@docker ps --filter "name=web-ros" --filter "name=movel"
	@echo ""
	@echo "Backend health:"
	@curl -s http://localhost:4000/health || true
	@echo ""
	@echo ""
	@echo "Robot state:"
	@curl -s http://localhost:4000/api/robot/state || true
	@echo ""
	@echo ""
	@echo "Frontend: http://localhost:3000"

down:
	docker compose down
	docker compose -f docker-compose-assignment.yaml down

restart: down up

status:
	docker ps --filter "name=web-ros" --filter "name=movel"

logs:
	docker compose logs -f

health:
	curl -s http://localhost:4000/health

state:
	curl -s http://localhost:4000/api/robot/state

frontend:
	@echo "Open: http://localhost:3000"
