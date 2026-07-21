# Single shared entrypoint. CI (.github/workflows/*) invokes these targets
# verbatim so local == CI. Requires: uv/uvx, python3, bash.
SKILLSAW_VERSION := 0.16.0
SKILL_DIR := plugins/auth0/skills/auth0

.PHONY: check lint scan test

## check: run everything CI runs (lint + scan)
check: lint scan

## lint: skillsaw + router reachability + routing evals + structural gate
lint: test
	uvx -q skillsaw@$(SKILLSAW_VERSION) --strict
	uv run python scripts/check_router_reachability.py $(SKILL_DIR)
	uv run python scripts/check_routing_evals.py $(SKILL_DIR)
	bash $(SKILL_DIR)/scripts/validate-skill.sh

## test: unit tests for the repo's Python checkers
test:
	uv run --with pytest python -m pytest scripts/test_check_router_reachability.py scripts/test_check_routing_evals.py scripts/test_check_snyk_findings.py -q

## scan: Snyk agent-scan over all skill markdown + finding gate
##   Requires SNYK_TOKEN. Skips with a notice if unset (fork PRs are out of scope).
scan:
	@if [ -z "$$SNYK_TOKEN" ]; then \
		echo "SNYK_TOKEN not set — skipping agent-scan (runs on main / same-repo PRs)."; \
	else \
		bash scripts/scan_all_skills.sh && python3 scripts/check_snyk_findings.py; \
	fi
