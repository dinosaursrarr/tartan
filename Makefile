.PHONY: lint
lint:
	go tool -modfile tools/golangci-lint/go.mod golangci-lint run --config ./golangci.yml

.PHONY: test
test:
	go test -v ./...

.PHONY: fix
fix:
	go fix ./...