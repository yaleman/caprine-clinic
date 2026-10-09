default:
    just --list
build:
    npm run build
deploy: build
    python3 scripts/local.py deploy
check:
    npm run check
init:
    python3 scripts/local.py init
up:
    python3 scripts/local.py up
status:
    python3 scripts/local.py status
smoke:
    python3 scripts/local.py smoke
down:
    docker compose down
# Explicitly destroys this project's test data only.
reset:
    docker compose down --volumes
