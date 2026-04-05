  document.addEventListener("DOMContentLoaded", function() {
    // Prevent any page scrolling
    document.body.style.overflow = "hidden";

    // ------------------------------
    // GAME STATE VARIABLES & UI ELEMENTS
    // ------------------------------
    let gameState = "start"; // states: start, playing, paused, gameover, victory
    let score = 0;
    let level = 1;
    const MAX_LEVEL = 10;
    const EXTRA_LIFE_SCORE_THRESHOLD = 1500; // Extra life every 1500 points
    let lives = 3;
    let shipHitCount = 0; // Ship takes 3 hits before losing a life
    let shipDamageFlash = 0; // Frames remaining for red damage flash
    let lastShotTime = 0; // Timestamp of last bullet fired (cooldown)

    // Keys tracking
    let keys = {};

    // Game area dimensions
    const GAME_WIDTH = 800, GAME_HEIGHT = 600;

    // Get canvas and its context
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    // UI displays (from index.html)
    const scoreDisplay = document.getElementById("score-outside");
    const livesDisplay = document.getElementById("lives-outside");
    const levelDisplay = document.getElementById("level-outside");

    // ------------------------------
    // SCOREBOARD (localStorage)
    // ------------------------------
    function getScores() {
      try {
        return JSON.parse(localStorage.getItem("galaxia_scores") || "[]");
      } catch(e) {
        return [];
      }
    }

    function saveScore(name, finalScore, finalLevel) {
      let scores = getScores();
      scores.push({ name: (name.trim() || "Player"), score: finalScore, level: finalLevel });
      scores.sort(function(a, b) { return b.score - a.score; });
      localStorage.setItem("galaxia_scores", JSON.stringify(scores.slice(0, 10)));
    }

    function renderScoreboard() {
      const tbody = document.getElementById("scoreboard-body");
      const scores = getScores();
      tbody.innerHTML = "";
      if (scores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No scores yet</td></tr>';
        return;
      }
      scores.forEach(function(entry, i) {
        let tr = document.createElement("tr");
        if (i === 0) tr.className = "top-score";
        tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + entry.name + "</td><td>" + entry.score + "</td><td>" + entry.level + "</td>";
        tbody.appendChild(tr);
      });
    }

    // ------------------------------
    // MODAL FUNCTIONS (pop-up within game box)
    // ------------------------------
    function showModal(message, buttonText, callback, showScores) {
      const modalOverlay = document.getElementById("modal-overlay");
      const modalMessage = document.getElementById("modal-message");
      const modalButton = document.getElementById("modal-button");
      const modalScoreboard = document.getElementById("modal-scoreboard");
      modalMessage.textContent = message;
      modalButton.textContent = buttonText;
      if (showScores) {
        renderScoreboard();
        modalScoreboard.style.display = "block";
      } else {
        modalScoreboard.style.display = "none";
      }
      modalOverlay.style.display = "flex";
      modalButton.onclick = function() {
        modalOverlay.style.display = "none";
        if (callback) callback();
      };
    }

    function showNameEntry(title, finalScore, finalLevel, callback) {
      const overlay = document.getElementById("name-entry-overlay");
      document.getElementById("name-entry-title").textContent = title;
      document.getElementById("name-entry-score").textContent = "Score: " + finalScore + "  |  Level: " + finalLevel;
      const input = document.getElementById("name-input");
      input.value = "";
      overlay.style.display = "flex";
      function submit() {
        overlay.style.display = "none";
        saveScore(input.value, finalScore, finalLevel);
        callback();
      }
      document.getElementById("name-submit-button").onclick = submit;
      input.onkeydown = function(e) { if (e.key === "Enter") submit(); };
      setTimeout(function() { input.focus(); }, 50);
    }

    // ------------------------------
    // SOUND MANAGEMENT
    // ------------------------------
    const sounds = {
      credit: new Audio("assets/sounds/01. Credit Sound.mp3"),
      startGame: new Audio("assets/sounds/02. Start Game.mp3"),
      shoot: new Audio("assets/sounds/03. Shoot.mp3"),
      fighterLoss: new Audio("assets/sounds/04. Fighter Loss.mp3"),
      extraLife: new Audio("assets/sounds/05. Extra Life.mp3"),
      flying: new Audio("assets/sounds/06. Flying Sound.mp3"),
      hitEnemy: new Audio("assets/sounds/07. Hit Enemy.mp3"),
      hitBoss: new Audio("assets/sounds/08. Hit Boss.mp3")
    };

    // ------------------------------
    // GAME OBJECTS & CONSTANTS
    // ------------------------------
    const SHIP_WIDTH = 80, SHIP_HEIGHT = 80;
    const BULLET_WIDTH = 12, BULLET_HEIGHT = 24, BULLET_SPEED = 7;
    const ENEMY_WIDTH = 50, ENEMY_HEIGHT = 50, ENEMY_PADDING = 10;
    const BOSS_SCALE = 1.3;

    // Ship object
    let ship = {
      image: new Image(),
      x: (GAME_WIDTH - SHIP_WIDTH) / 2,
      y: GAME_HEIGHT - SHIP_HEIGHT - 20,
      speed: 8,
      width: SHIP_WIDTH,
      height: SHIP_HEIGHT,
      lives: lives
    };
    ship.image.src = "assets/br_logo.png";
    ship.image.onerror = function() {
      console.error("Error loading ship image (assets/br_logo.png).");
    };

    // Preload ship bullet image
    let bulletImage = new Image();
    bulletImage.src = "assets/ammo_icon.png";
    bulletImage.onerror = function() {
      console.error("Error loading bullet image (assets/ammo_icon.png).");
    };

    // Boss image (level 10 only)
    let bossImage = new Image();
    bossImage.src = "assets/boss.png";
    bossImage.onerror = function() {
      console.error("Error loading boss image (assets/boss.png).");
    };
    let boss = null;

    // Pre-load all enemy images once — reused across levels
    const ENEMY_FILE_NAMES = [
      "american_football.jpeg",
      "basketball.jpeg",
      "golf_ball.jpeg",
      "tennis_ball.jpeg",
      "baseball.jpeg",
      "hockey_puck.jpeg",
      "soccer_ball.jpeg"
    ];
    const enemyImages = {};
    ENEMY_FILE_NAMES.forEach(function(fileName) {
      let img = new Image();
      img.src = "assets/" + fileName;
      img.onerror = function() {
        console.error("Error loading enemy image: assets/" + fileName);
      };
      enemyImages[fileName] = img;
    });

    // Arrays for bullets, enemies, enemy bullets
    let bullets = [];
    let enemies = [];
    let enemyBullets = [];

    // Mapping for enemy bullet sizes (by enemy image file)
    const enemyBulletSizes = {
      "american_football.jpeg": { width: 8, height: 16 },
      "basketball.jpeg": { width: 10, height: 20 },
      "golf_ball.jpeg": { width: 6, height: 12 },
      "tennis_ball.jpeg": { width: 7, height: 14 },
      "baseball.jpeg": { width: 9, height: 18 },
      "hockey_puck.jpeg": { width: 12, height: 24 },
      "soccer_ball.jpeg": { width: 11, height: 22 }
    };

    // ------------------------------
    // FORMATION CREATION FUNCTIONS
    // ------------------------------
    function createEnemies() {
      enemies = [];
      const totalRows = 4;
      let baseSpeed = 0.5;
      for (let row = 0; row < totalRows; row++) {
        let enemyCount = ENEMY_FILE_NAMES.length;
        let totalEnemyWidth = enemyCount * ENEMY_WIDTH + (enemyCount - 1) * ENEMY_PADDING;
        let startX = (GAME_WIDTH - totalEnemyWidth) / 2;
        let yPos = 50 + row * (ENEMY_HEIGHT + ENEMY_PADDING);
        ENEMY_FILE_NAMES.forEach(function(fileName, index) {
          let enemy = {
            image: enemyImages[fileName], // use pre-loaded cached image
            x: startX + index * (ENEMY_WIDTH + ENEMY_PADDING),
            y: yPos,
            width: ENEMY_WIDTH,
            height: ENEMY_HEIGHT,
            speed: baseSpeed * Math.pow(1.08, level - 1), // 8% increase per level
            direction: 1,
            type: fileName
          };
          enemy.bulletSize = enemyBulletSizes[fileName] || { width: 8, height: 16 };
          enemy.bulletSpeed = 4;
          enemy.bulletColor = "red";
          enemies.push(enemy);
        });
      }
    }

    // Create boss (level 10 only)
    function createBoss() {
      let bossSpeed = 2 * Math.pow(1.08, 5);
      boss = {
        image: bossImage,
        x: (GAME_WIDTH - SHIP_WIDTH * BOSS_SCALE) / 2,
        y: 20,
        width: SHIP_WIDTH * BOSS_SCALE,
        height: SHIP_HEIGHT * BOSS_SCALE,
        speed: bossSpeed,
        direction: 1,
        health: 10
      };
    }

    // ------------------------------
    // COLLISION DETECTION
    // ------------------------------
    function isColliding(rect1, rect2) {
      return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y;
    }

    // Utility: Only the lowest enemy (by y) of a given type may fire
    function canEnemyFire(enemy) {
      for (let other of enemies) {
        if (other !== enemy && other.type === enemy.type && other.y > enemy.y) {
          return false;
        }
      }
      return true;
    }

    // ------------------------------
    // GAME MECHANICS
    // ------------------------------
    function shootBullet() {
      if (gameState !== "playing") return;
      const now = Date.now();
      if (now - lastShotTime < 200) return; // 200ms cooldown — prevents bullet spam
      lastShotTime = now;
      let bullet = {
        x: ship.x + ship.width / 2 - BULLET_WIDTH / 2,
        y: ship.y,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        speed: BULLET_SPEED
      };
      bullets.push(bullet);
      sounds.shoot.currentTime = 0;
      sounds.shoot.play();
    }

    function checkExtraLife() {
      if (score > 0 && score % EXTRA_LIFE_SCORE_THRESHOLD === 0) {
        ship.lives++;
        livesDisplay.textContent = "Lives: " + ship.lives;
        sounds.extraLife.currentTime = 0;
        sounds.extraLife.play();
      }
    }

    // ------------------------------
    // MAIN GAME LOOP
    // ------------------------------
    function gameLoop() {
      if (gameState !== "playing") return;
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Update ship position
      if (keys["ArrowLeft"]) ship.x -= ship.speed;
      if (keys["ArrowRight"]) ship.x += ship.speed;
      if (ship.x < 0) ship.x = 0;
      if (ship.x + ship.width > GAME_WIDTH) ship.x = GAME_WIDTH - ship.width;

      // Draw ship — red overlay flash when hit but not yet losing a life
      if (shipDamageFlash > 0) {
        ctx.save();
        ctx.drawImage(ship.image, ship.x, ship.y, ship.width, ship.height);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "red";
        ctx.fillRect(ship.x, ship.y, ship.width, ship.height);
        ctx.restore();
        shipDamageFlash--;
      } else {
        ctx.drawImage(ship.image, ship.x, ship.y, ship.width, ship.height);
      }

      // Update and draw ship bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        bullet.y -= bullet.speed;
        if (bullet.y + bullet.height < 0) {
          bullets.splice(i, 1);
          continue;
        }
        ctx.drawImage(bulletImage, bullet.x, bullet.y, bullet.width, bullet.height);
      }

      // Enemy firing: each enemy (if lowest of its type) fires with a small chance
      enemies.forEach(function(enemy) {
        if (canEnemyFire(enemy) && Math.random() < 0.005) {
          let eb = {
            x: enemy.x + enemy.width / 2 - enemy.bulletSize.width / 2,
            y: enemy.y + enemy.height,
            width: enemy.bulletSize.width,
            height: enemy.bulletSize.height,
            speed: enemy.bulletSpeed,
            color: enemy.bulletColor
          };
          enemyBullets.push(eb);
        }
      });

      // Update and draw enemy bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        eb.y += eb.speed;
        if (eb.y > GAME_HEIGHT) {
          enemyBullets.splice(i, 1);
          continue;
        }
        ctx.fillStyle = eb.color;
        ctx.fillRect(eb.x, eb.y, eb.width, eb.height);
      }

      // Update and draw enemies with bouncing (horizontal reversal only)
      enemies.forEach(function(enemy) {
        enemy.x += enemy.speed * enemy.direction;
        if (enemy.x <= 0) enemy.direction = 1;
        if (enemy.x + enemy.width >= GAME_WIDTH) enemy.direction = -1;
        ctx.drawImage(enemy.image, enemy.x, enemy.y, enemy.width, enemy.height);
      });

      // Update and draw boss if present
      if (boss) {
        boss.x += boss.speed * boss.direction;
        if (boss.x <= 0) boss.direction = 1;
        if (boss.x + boss.width >= GAME_WIDTH) boss.direction = -1;
        ctx.drawImage(boss.image, boss.x, boss.y, boss.width, boss.height);
      }

      // Collision: Ship bullets vs. enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        for (let j = bullets.length - 1; j >= 0; j--) {
          if (isColliding(enemies[i], bullets[j])) {
            score += 100;
            scoreDisplay.textContent = "Score: " + score;
            sounds.hitEnemy.currentTime = 0;
            sounds.hitEnemy.play();
            enemies.splice(i, 1);
            bullets.splice(j, 1);
            checkExtraLife();
            break;
          }
        }
      }

      // Collision: Ship bullets vs. boss
      if (boss) {
        for (let j = bullets.length - 1; j >= 0; j--) {
          if (isColliding(boss, bullets[j])) {
            boss.health--;
            bullets.splice(j, 1);
            sounds.hitBoss.currentTime = 0;
            sounds.hitBoss.play();
            if (boss.health <= 0) {
              score += 1000;
              scoreDisplay.textContent = "Score: " + score;
              boss = null;
              gameState = "victory";
              startFireworks();
              showNameEntry("Victory!", score, level, function() {
                showModal("Victory! — Final Score: " + score, "Play Again", startGame, true);
              });
            }
            break;
          }
        }
      }

      // Collision: Enemy bullets vs. ship (accumulate hits; 3 hits lose a life)
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        if (isColliding(enemyBullets[i], ship)) {
          shipHitCount++;
          shipDamageFlash = 20; // ~1/3 second red flash at 60fps
          enemyBullets.splice(i, 1);
          if (shipHitCount >= 3) {
            ship.lives--;
            shipHitCount = 0;
            shipDamageFlash = 0;
            livesDisplay.textContent = "Lives: " + ship.lives;
            sounds.fighterLoss.currentTime = 0;
            sounds.fighterLoss.play();
          }
          if (ship.lives <= 0) {
            gameState = "gameover";
            showNameEntry("Game Over", score, level, function() {
              showModal("Game Over — Final Score: " + score, "Restart", startGame, true);
            });
            break; // stop processing further enemy bullets this frame
          }
        }
      }

      // Level up: if all enemies (and boss) are cleared, start new level (1-10)
      if (enemies.length === 0 && !boss) {
        if (level < MAX_LEVEL) {
          level++;
          levelDisplay.textContent = "Level: " + level;
          bullets = [];        // clear stale player bullets between levels
          enemyBullets = [];   // clear stale enemy bullets between levels
          createEnemies();
          if (level === MAX_LEVEL) {
            createBoss();
          }
        }
      }

      requestAnimationFrame(gameLoop);
    }

    // ------------------------------
    // FIREWORK EFFECT (Victory)
    // ------------------------------
    function startFireworks() {
      const fwCanvas = document.getElementById("firework-canvas");
      const fwCtx = fwCanvas.getContext("2d");
      fwCanvas.width = canvas.width;
      fwCanvas.height = canvas.height;
      let particles = [];
      function createParticle() {
        return {
          x: Math.random() * fwCanvas.width,
          y: Math.random() * fwCanvas.height,
          radius: Math.random() * 3 + 1,
          color: 'hsl(' + Math.random() * 360 + ', 100%, 50%)',
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4
        };
      }
      for (let i = 0; i < 100; i++) {
        particles.push(createParticle());
      }
      function animateFireworks() {
        fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          fwCtx.beginPath();
          fwCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          fwCtx.fillStyle = p.color;
          fwCtx.fill();
        });
        requestAnimationFrame(animateFireworks);
      }
      animateFireworks();
    }

    // ------------------------------
    // GAME CONTROL FUNCTIONS
    // ------------------------------
    function startGame() {
      score = 0;
      level = 1;
      ship.lives = 3;
      shipHitCount = 0;
      shipDamageFlash = 0;
      scoreDisplay.textContent = "Score: " + score;
      livesDisplay.textContent = "Lives: " + ship.lives;
      levelDisplay.textContent = "Level: " + level;
      createEnemies();
      boss = null;
      bullets = [];
      enemyBullets = [];
      gameState = "playing";
      sounds.startGame.currentTime = 0;
      sounds.startGame.play();
      requestAnimationFrame(gameLoop);
    }

    function pauseGame() {
      if (gameState === "playing") {
        gameState = "paused";
        showModal("Game Paused", "Resume", function() {
          gameState = "playing";
          requestAnimationFrame(gameLoop);
        });
      }
    }

    // ------------------------------
    // EVENT HANDLERS
    // ------------------------------
    document.addEventListener("keydown", function(e) {
      keys[e.key] = true;
      if (e.code === "Space") {
        e.preventDefault();
        if (gameState === "playing") shootBullet();
      }
      if (e.key === "p" || e.key === "P") {
        pauseGame();
      }
    });
    document.addEventListener("keyup", function(e) {
      keys[e.key] = false;
    });
    document.getElementById("btn-left").addEventListener("touchstart", function(e) {
      keys["ArrowLeft"] = true;
      e.preventDefault();
    });
    document.getElementById("btn-left").addEventListener("touchend", function(e) {
      keys["ArrowLeft"] = false;
      e.preventDefault();
    });
    document.getElementById("btn-right").addEventListener("touchstart", function(e) {
      keys["ArrowRight"] = true;
      e.preventDefault();
    });
    document.getElementById("btn-right").addEventListener("touchend", function(e) {
      keys["ArrowRight"] = false;
      e.preventDefault();
    });
    document.getElementById("btn-shoot").addEventListener("touchstart", function(e) {
      shootBullet();
      e.preventDefault();
    });
    document.getElementById("btn-pause").addEventListener("touchstart", function(e) {
      pauseGame();
      e.preventDefault();
    });

    // Show start modal with scoreboard
    showModal("Press Start to Begin", "Start Game", startGame, true);
  });
