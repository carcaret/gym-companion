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
wttag=""
if [ -n "$WTNAME" ]; then
  wttag=" ${DIM}[wt:${R}${BC}${WTNAME}${DIM}]${R}"
else
  wttag=" ${DIM}[no-wt]${R}"
fi

countdown(){ r="$1"; now=$(date +%s); s=$((r-now)); [ "$s" -lt 0 ]&&s=0; dd=$((s/86400)); h=$(((s%86400)/3600)); m=$(((s%3600)/60)); if [ "$dd" -gt 0 ]; then printf '%dd%dh' "$dd" "$h"; elif [ "$h" -gt 0 ]; then printf '%dh%02dm' "$h" "$m"; else printf '%dm' "$m"; fi; }
clock(){ TZ=Europe/Madrid date -d "@$1" +"$2" 2>/dev/null || TZ=Europe/Madrid date -r "$1" +"$2" 2>/dev/null; }

# context window progress bar
PCT=$(j '.context_window.used_percentage // 0' | cut -d. -f1)
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
ctxline="${BARCOLOR}${BAR}${R} ${PCT}%"

# rate limits — 5h: reset countdown only. 7d: used % (numeric, no bar)
usage=""
five=$(j '.rate_limits.five_hour.used_percentage // empty')
week=$(j '.rate_limits.seven_day.used_percentage // empty')
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

line="${pre}"
[ -n "$b" ] && line="${line}${BC}(${BR}${b}${x}${BC})${R}${wttag} "
[ -z "$b" ] && line="${line}${wttag} "
line="${line}${BC}[${MODEL}]${R} ${ctxline}"
[ -n "$usage" ] && line="${line} ${DIM}·${R} ${usage}"
printf '%s' "$line"
