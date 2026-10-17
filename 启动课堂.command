#!/bin/zsh
set -e
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CLASSROOM_URL="http://127.0.0.1:${CLASSROOM_PORT:-3765}"
if curl -fsS "$CLASSROOM_URL/api/health" 2>/dev/null | /usr/bin/grep -q 'arduino-classroom'; then
  open "$CLASSROOM_URL"
  exit 0
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo '未找到 Node.js。请先安装 Node.js 22.12+（或 24+）后再双击。'
  read 'reply?按回车退出'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo '第一次使用，安装本地依赖…'
  npm ci
fi
if [[ ! -f dist/index.html || src/main.js -nt dist/index.html || src/blocks.js -nt dist/index.html || src/lessons.js -nt dist/index.html || src/style.css -nt dist/index.html || src/circuits.js -nt dist/index.html || src/circuit-view.js -nt dist/index.html || src/circuit.css -nt dist/index.html || src/beginner.js -nt dist/index.html || src/beginner.css -nt dist/index.html || src/meanings.js -nt dist/index.html ]]; then
  npm run build
fi
nohup node server.mjs > .classroom.log 2>&1 < /dev/null &
echo $! > .classroom.pid
for attempt in {1..40}; do
  if curl -fsS "$CLASSROOM_URL/api/health" 2>/dev/null | /usr/bin/grep -q 'arduino-classroom'; then
    open "$CLASSROOM_URL"
    echo "课堂已打开：$CLASSROOM_URL"
    exit 0
  fi
  sleep 0.25
done
echo '启动失败，请查看当前目录中的 .classroom.log。'
cat .classroom.log
read 'reply?按回车退出'
exit 1
