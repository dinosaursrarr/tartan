.PHONY: lint
lint: go-lint web-lint

.PHONY: test
test: go-test

GO_WILDCARD := $(shell go list ./... | grep -v /internal/web/)

.PHONY: go-build
go-build: web-build
	go build -o bin/sett cmd/main.go

.PHONY: go-run
go-run: go-build
	./bin/sett

.PHONY: go-lint
go-lint:
	go tool -modfile tools/golangci-lint/go.mod golangci-lint run --config ./golangci.yml

.PHONY: go-test
go-test:
	go test $(GO_WILDCARD)

.PHONY: go-fix
go-fix:
	go fix $(GO_WILDCARD)

.PHONY: web-dev
web-dev:
	cd internal/web && npm run dev

.PHONY: web-build
web-build:
	cd internal/web && npm run build

.PHONY: web-lint
web-lint:
	cd internal/web && npm run lint
	cd internal/web && npm run typecheck

.PHONY: web-format
web-format:
	cd internal/web && npm run format
