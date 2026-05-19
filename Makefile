.PHONY: frontend up down restart logs

frontend:
	docker-compose build nginx
	docker-compose up -d nginx

up:
	docker-compose up -d postgres backend nginx

down:
	docker-compose down

restart:
	docker-compose restart nginx

logs:
	docker-compose logs -f --tail=200
