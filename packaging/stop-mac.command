#!/bin/zsh
CLASSROOM_SUPPORT="${CLASSROOM_SUPPORT_DIR:-$HOME/Library/Application Support/ArduinoClassroom}"
CLASSROOM_RECORD="$CLASSROOM_SUPPORT/service.json"
if [[ ! -f "$CLASSROOM_RECORD" ]]; then
  echo '课堂当前未运行。'
  exit 0
fi
# Read only numeric values; never evaluate the contents of the record as shell code.
CLASSROOM_PID=$(/usr/bin/sed -nE 's/.*"pid":([0-9]+).*/\1/p' "$CLASSROOM_RECORD")
if [[ "$CLASSROOM_PID" == <-> ]] && /bin/ps -p "$CLASSROOM_PID" -o command= | /usr/bin/grep -q '/app/server.mjs'; then
  kill -INT "$CLASSROOM_PID"
  echo '已停止课堂上传与串口服务。'
else
  echo '未找到课堂进程。'
fi
