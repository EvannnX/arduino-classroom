#!/bin/zsh
cd "${0:A:h}"
if [[ -f .classroom.pid ]]; then
  CLASSROOM_PID=$(cat .classroom.pid)
  if [[ "$CLASSROOM_PID" == <-> ]] && ps -p "$CLASSROOM_PID" -o command= | /usr/bin/grep -q 'node server.mjs'; then
    kill -INT "$CLASSROOM_PID"
    echo '已停止本地课堂服务。'
  else
    echo '没有找到此启动脚本运行的课堂服务。'
  fi
  rm -f .classroom.pid
else
  echo '课堂服务没有通过启动脚本运行。终端启动的服务请按 Control-C。'
fi
