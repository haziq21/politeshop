watch_server:
	@cd server && air --build.cmd "go build -o tmp/main . && templ generate --notify-proxy" --build.bin "./tmp/main"

watch_templates:
	@cd server && templ generate --watch --proxy="http://localhost:8080" --open-browser=false >/dev/null 2>&1

watch_server_assets:
	@cd server && npm run watch-server

watch:
	@make -j3 watch_server watch_templates watch_server_assets