# BR Galaxia

BR Galaxia is a classic arcade-inspired game built with HTML5 Canvas, Docker, and Nginx. The game includes multiple levels, enemy formations, a boss battle on level 10, extra life mechanics, sound effects, and a full set of overlays (Start, Pause, Game Over, and Victory screens). Additionally, server logs are stored in a dedicated `log` folder using a custom Nginx configuration.

## Features

- **Game Area:**  
  - A fixed 800×600 gameplay area centered in the browser.
  - The game box is outlined by a border, while UI elements (game title, score, lives, and control info) are displayed outside of it.

- **User Interface:**  
  - **Game Title:** Displayed at the top left outside the game box.
  - **Score:** Displayed at the top right outside the game box.
  - **Lives:** The ship starts with 3 lives, and extra lives are earned after certain score thresholds. Lives are displayed below the score.
  - **Control Info:** Instructions and touch control buttons are displayed at the bottom right outside the game box.

- **Gameplay Mechanics:**
  - **Enemies:** Arranged in 4 rows using unique enemy images. They bounce off the left/right boundaries and move downward.
  - **Levels:** There are 10 levels. Each level increases enemy speed by 8%. On level 10, a boss (30% larger than the main ship) appears alongside remaining enemies.
  - **Bullets:** 200ms cooldown between shots — prevents spam. Bullets and enemy bullets are cleared between levels.
  - **Extra Lives:** Extra lives are awarded each time a defined score threshold is reached.
  - **Overlays:** Start Menu, Pause screen, Game Over screen, and Victory screen (with fireworks on victory).

- **Scoreboard:**
  - Top 10 high scores stored in `localStorage` — persists across sessions.
  - After game over or victory, a name entry prompt appears before the score is saved.
  - High scores table is shown on the start screen and after each game ends.
  
- **Sound Effects:**  
  The game integrates several sound effects inspired by Galaga. Place the following sound files in `src/assets/sounds/`:
  - `01. Credit Sound.mp3`
  - `02. Start Game.mp3`
  - `03. Shoot.mp3`
  - `04. Fighter Loss.mp3`
  - `05. Extra Life.mp3`
  - `06. Flying Sound.mp3`
  - `07. Hit Enemy.mp3`
  - `08. Hit Boss.mp3`

- **Logging:**  
  A custom Nginx configuration writes access and error logs to `/var/log/galaxia`, which is mapped to the local `log` folder in the project root. This allows you to inspect the logs for debugging.

## Deployment

### Docker (local)
```bash
docker compose up -d --build
```
Game runs at `http://localhost:5023`.

### VPS via Portainer
Files are deployed to `/opt/galaxia/` on Negril (Tailscale: `100.108.31.115`).
The image is built locally on the VPS and managed as a Portainer stack named `galaxia`.

```bash
# Rebuild and redeploy after changes
rsync -avz Galaxia_Project_alt/ root@100.108.31.115:/opt/galaxia/
ssh root@100.108.31.115 "docker build -t galaxia:latest /opt/galaxia/"
# Then redeploy stack via Portainer UI or API
```

Game accessible at `http://100.108.31.115:5023` (Tailscale only).

---

## Changelog

### 2026-04-05
- **Fix:** Fireworks now actually trigger on victory (function was defined but never called)
- **Fix:** Bullet cooldown (200ms) added — rapid-fire spam no longer possible
- **Fix:** Space bar now guarded to only shoot during `playing` state
- **Fix:** `bullets[]` cleared on new game start and between levels
- **Fix:** `enemyBullets[]` cleared between levels — stale bullets no longer carry over from previous level
- **Fix:** Enemy bullet collision loop breaks immediately after game over is set
- **Cleanup:** Removed remaining debug `console.log`

### 2026-04-04 (2)
- **Feature:** Scoreboard system — top 10 scores saved to `localStorage` with name entry after game over/victory; scores displayed on start screen and post-game modals
- **Improvement:** Enemy speed scaling increased from 5% to 8% per level (`Math.pow(1.08, level - 1)`); boss speed updated to match

### 2026-04-04
- **Fix (critical):** Added `include /etc/nginx/mime.types` to `nginx.conf` — JS/CSS/MP3/PNG were being served as `application/octet-stream`, preventing the game from loading
- **Fix:** Port bound to Tailscale IP (`100.108.31.115:5023`) instead of `0.0.0.0`
- **Improvement:** Enemy images pre-loaded once at startup and cached — previously 28 new `Image()` objects were created on every level
- **Improvement:** Ship flashes red for ~20 frames on hits 1 and 2 (before losing a life), giving visual damage feedback
- **Improvement:** Added gzip compression and 7-day cache headers for static assets in nginx
- **Improvement:** Added Docker healthcheck and `no-new-privileges` security option
- **Cleanup:** Removed debug `console.log` on every image load; kept only error handlers
- **Cleanup:** Removed deprecated `version:` field from `docker-compose.yml`

---

## File Structure

