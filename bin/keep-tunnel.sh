#!/bin/bash
PORT=8765
LOG=/tmp/gds-lt.log
PIDFILE=/tmp/gds-tunnel.pid
URLFILE=/workspace/grimdark-survivors/URL.txt
LT=/home/box/.local/bin/lt
while true; do
  if ! kill -0 $(cat $PIDFILE 2>/dev/null) 2>/dev/null; then
    $LT --port $PORT > $LOG 2>&1 &
    echo $! > $PIDFILE
    sleep 4
    URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.loca\.lt' $LOG | head -1)
    {
      echo "$URL"
      echo "PORT=$PORT"
      echo "HTTP_PID=$(cat /tmp/gds-http.pid 2>/dev/null)"
      echo "TUNNEL_PID=$(cat $PIDFILE)"
      echo "CLOUDFLARED_PID=$(cat /tmp/gds-cf.pid 2>/dev/null)"
      echo "NOTE=cloudflared edge blocked (port 7844); using localtunnel. Phone: open URL, if interstitial enter IP or wait; header Bypass-Tunnel-Reminder works for tools."
    } > $URLFILE
  fi
  sleep 20
done
