.PHONY: up down build logs clean

up:
	cd docker && docker-compose up -d

down:
	cd docker && docker-compose down

build:
	cd docker && docker-compose up -d --build

logs:
	cd docker && docker-compose logs -f

clean:
	cd docker && docker-compose down -v
	rm -rf volumes/*

db-shell:
	cd docker && docker-compose exec db psql -U postgres

app-shell:
	cd docker && docker-compose exec vite-app sh