#!/bin/bash
input=$(cat)
j(){ printf '%s' "$input" | jq -r "$1"; }

F="$HOME/.claude/.caveman-active"; pre=""
if [ -f "$F" ] && [ ! -L "$F" ]; then
  M=$(head -c 16 "$F" 2>/dev/null|tr -cd 'a-z-')
  case "$M" in
    off) ;;
    full|"") pre=$(printf '\033[38;5;172m[CAVEMAN]\033[0m ');;
    *) pre=$(printf '\033[38;5;172m[CAVEMAN:%s]\033[0m ' "$(printf %s "$M"|tr a-z A-Z)");;
  esac
fi

cwd=$(j '.workspace.current_dir')
MODEL=$(j '.model.display_name')

BC=$(printf '\033[1;36m'); BR=$(printf '\033[1;31m'); Y=$(printf '\033[1;33m')
G=$(printf '\033[0;32m'); DIM=$(printf '\033[2m'); R=$(printf '\033[0m')

b=""; x=""
if git -C "$cwd" --no-optional-locks rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  b=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null||git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null)
  if [ -n "$b" ] && ! git -C "$cwd" --no-optional-locks diff --quiet 2>/dev/null; then x=" ${Y}✗${R}"; fi
fi

WTNAME=$(j '.workspace.git_worktree // empty')
[ -z "$WTNAME" ] && WTNAME=$(j '.worktree.name // empty')
if [ -n "$WTNAME" ]; then
  wttag=" ${G}[wt]${R}"
else
  wttag=" ${DIM}[wt]${R}"
fi

countdown(){ r="$1"; now=$(date +%s); s=$((r-now)); [ "$s" -lt 0 ]&&s=0; dd=$((s/86400)); h=$(((s%86400)/3600)); m=$(((s%3600)/60)); if [ "$dd" -gt 0 ]; then printf '%dd%dh' "$dd" "$h"; elif [ "$h" -gt 0 ]; then printf '%dh%02dm' "$h" "$m"; else printf '%dm' "$m"; fi; }
clock(){ TZ=Europe/Madrid date -d "@$1" +"$2" 2>/dev/null || TZ=Europe/Madrid date -r "$1" +"$2" 2>/dev/null; }

five=$(j '.rate_limits.five_hour.used_percentage // empty')
week=$(j '.rate_limits.seven_day.used_percentage // empty')

# 5h progress bar — tokens used in current 5h window
PCT=$(printf '%s' "${five:-0}" | cut -d. -f1)
[ -z "$PCT" ] && PCT=0
BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
if [ "$PCT" -ge 80 ]; then BARCOLOR="$BR"
elif [ "$PCT" -ge 50 ]; then BARCOLOR="$Y"
else BARCOLOR="$G"; fi
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"
barline="${BARCOLOR}${BAR}${R} ${PCT}%"

# rate limits — 5h: reset countdown only (bar shows the %). 7d: numeric, no bar
usage=""
if [ -n "$five" ]; then
  fr=$(j '.rate_limits.five_hour.resets_at // empty')
  usage="${DIM}5h${R}"
  [ -n "$fr" ] && usage="${usage} ${DIM}↻$(clock "$fr" '%H:%M') ($(countdown "$fr"))${R}"
fi
if [ -n "$week" ]; then
  WU=$(awk -v v="$week" 'BEGIN{printf "%.0f",v}')
  WEEKTXT="${DIM}7d${R} ${WU}%"
  fr7=$(j '.rate_limits.seven_day.resets_at // empty')
  [ -n "$fr7" ] && WEEKTXT="${WEEKTXT} ${DIM}↻$(clock "$fr7" '%a %H:%M') ($(countdown "$fr7"))${R}"
  [ -n "$usage" ] && usage="${usage} ${DIM}·${R} ${WEEKTXT}" || usage="$WEEKTXT"
fi

# context window — plain number at the end
CTXPCT=$(j '.context_window.used_percentage // empty' | cut -d. -f1)
ctxtxt=""
[ -n "$CTXPCT" ] && ctxtxt="${DIM}ctx${R} ${CTXPCT}%"

LEFT="${pre}"
[ -n "$b" ] && LEFT="${LEFT}${BC}[${BR}${b}${x}${BC}]${R}${wttag}"
[ -z "$b" ] && LEFT="${LEFT}${wttag}"

RIGHT="${BC}[${MODEL}]${R} ${barline}"
[ -n "$usage" ] && RIGHT="${RIGHT} ${DIM}·${R} ${usage}"
[ -n "$ctxtxt" ] && RIGHT="${RIGHT} ${DIM}·${R} ${ctxtxt}"

strip_ansi(){ printf '%s' "$1" | sed -E 's/\x1b\[[0-9;]*m//g'; }
LEFT_PLAIN=$(strip_ansi "$LEFT")
RIGHT_PLAIN=$(strip_ansi "$RIGHT")
LEFT_LEN=${#LEFT_PLAIN}
RIGHT_LEN=${#RIGHT_PLAIN}

MARGIN=4
COLS="${COLUMNS:-0}"
GAP=$((COLS - LEFT_LEN - RIGHT_LEN - MARGIN))
if [ "$COLS" -gt 0 ] && [ "$GAP" -gt 0 ]; then
  printf -v PADDING '%*s' "$GAP" ''
  printf '%s%s%s' "$LEFT" "$PADDING" "$RIGHT"
else
  printf '%s %s' "$LEFT" "$RIGHT"
fi
