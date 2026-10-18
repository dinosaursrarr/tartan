GO_WILDCARD := $(shell go list ./... | grep -v /internal/web/)

.PHONY: go-build
go-build: web-build
	go build -o bin/sett cmd/main.go

.PHONY: run
run: go-build
	./bin/sett

.PHONY: lint
lint:
	go tool -modfile tools/golangci-lint/go.mod golangci-lint run --config ./golangci.yml

.PHONY: test
test:
	go test $(GO_WILDCARD)

.PHONY: fix
fix:
	go fix $(GO_WILDCARD)

.PHONY: web-dev
web-dev:
	cd internal/web && npm run dev

.PHONY: web-build
web-build:
	cd internal/web && npm run build
