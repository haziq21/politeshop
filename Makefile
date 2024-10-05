watch_server:
	@cd server && air

watch_templates:
	@cd server && templ generate --watch >/dev/null

watch:
	@make -j2 watch_server watch_templates