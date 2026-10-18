.PHONY: lint
lint:
	go tool -modfile tools/golangci-lint/go.mod golangci-lint run --config ./golangci.yml

.PHONY: test
test:
	go test ./...

.PHONY: fix
fix:
	go fix ./...