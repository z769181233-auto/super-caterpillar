#!/usr/bin/env bash
# Common env loader for gates
export API_PORT=3001
export API_URL="http://127.0.0.1:$API_PORT"
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi
