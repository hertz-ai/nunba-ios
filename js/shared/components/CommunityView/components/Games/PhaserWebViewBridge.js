import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, fontSize, fontWeight } from '../../../../theme/colors';

/**
 * PhaserWebViewBridge — Loads a Phaser 3 game inside a WebView.
 *
 * Communication protocol:
 *   Game → RN:  { type: 'READY' | 'SCORE_UPDATE' | 'GAME_COMPLETE' | 'LIFE_LOST', payload }
 *   RN → Game:  { type: 'INIT' | 'OPPONENT_UPDATE' | 'PAUSE' | 'RESUME', payload }
 *
 * Props:
 *   sceneId: string        — Scene name (snake, breakout, pong, etc.)
 *   config: object          — Engine config from catalog entry
 *   multiplayer: object     — Multiplayer sync hook state
 *   onScoreUpdate: (score) => void
 *   onGameComplete: (finalScore) => void
 */
const PhaserWebViewBridge = ({
  sceneId = 'snake',
  config = {},
  multiplayer,
  onScoreUpdate,
  onGameComplete,
}) => {
  const webViewRef = useRef(null);

  // Build the HTML that loads Phaser and the game scene
  const gameHTML = buildGameHTML(sceneId, config);

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'READY':
          // Game scene is loaded, send init config
          sendToGame({ type: 'INIT', payload: config });
          break;
        case 'SCORE_UPDATE':
          if (onScoreUpdate) onScoreUpdate(msg.payload?.score ?? 0);
          if (multiplayer?.submitMove) {
            multiplayer.submitMove({ action: 'score_update', score: msg.payload?.score });
          }
          break;
        case 'GAME_COMPLETE':
          if (onGameComplete) onGameComplete(msg.payload?.score ?? 0);
          break;
        case 'LIFE_LOST':
          // Optional: track lives
          break;
        default:
          break;
      }
    } catch (_) {}
  }, [config, multiplayer, onScoreUpdate, onGameComplete]);

  const sendToGame = useCallback((msg) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  // Forward opponent state updates to game
  useEffect(() => {
    if (multiplayer?.scores) {
      sendToGame({
        type: 'OPPONENT_UPDATE',
        payload: { scores: multiplayer.scores },
      });
    }
  }, [multiplayer?.scores, sendToGame]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: gameHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading {sceneId}...</Text>
          </View>
        )}
      />
    </View>
  );
};

/**
 * Generate a self-contained HTML page that loads Phaser from CDN
 * and creates a simple game scene based on sceneId.
 */
function buildGameHTML(sceneId, config) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0F0E17; overflow: hidden; touch-action: none; }
    #game-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
  <script>
    // ── Bridge ──
    const nunbaBridge = {
      config: ${JSON.stringify(config)},
      opponentState: null,
      sendToRN: function(type, payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      },
      onScoreUpdate: function(score) {
        this.sendToRN('SCORE_UPDATE', { score });
      },
      onGameComplete: function(score) {
        this.sendToRN('GAME_COMPLETE', { score });
      },
      onLifeLost: function(lives) {
        this.sendToRN('LIFE_LOST', { lives });
      }
    };

    // Listen for messages from RN
    document.addEventListener('message', function(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INIT') nunbaBridge.config = msg.payload;
        if (msg.type === 'OPPONENT_UPDATE') nunbaBridge.opponentState = msg.payload;
      } catch(_) {}
    });
    window.addEventListener('message', function(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INIT') nunbaBridge.config = msg.payload;
        if (msg.type === 'OPPONENT_UPDATE') nunbaBridge.opponentState = msg.payload;
      } catch(_) {}
    });

    // ── Game Scenes ──
    ${getSceneCode(sceneId)}

    // ── Launch ──
    const gameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0F0E17',
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scene: [GameScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
    };

    const game = new Phaser.Game(gameConfig);
    game.registry.set('nunbaBridge', nunbaBridge);

    nunbaBridge.sendToRN('READY', { sceneId: '${sceneId}' });
  </script>
</body>
</html>`;
}

/**
 * Return inline Phaser scene JS code for common games.
 * Each scene reads config from nunbaBridge and reports scores back.
 */
function getSceneCode(sceneId) {
  switch (sceneId) {
    case 'snake':
      return SNAKE_SCENE;
    case 'breakout':
      return BREAKOUT_SCENE;
    case 'pong':
      return PONG_SCENE;
    default:
      return SNAKE_SCENE; // Default to snake
  }
}

// ── Inline Snake Scene ──
const SNAKE_SCENE = `
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() {
    this.gridSize = 20;
    this.cellSize = Math.min(this.scale.width, this.scale.height) / this.gridSize;
    this.snake = [{ x: 10, y: 10 }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.food = this.spawnFood();
    this.moveTimer = 0;
    this.moveInterval = 150;

    // Score text
    this.scoreText = this.add.text(10, 10, 'Score: 0', {
      fontSize: '18px', fill: '#fff', fontFamily: 'monospace'
    }).setDepth(10);

    // Touch controls
    this.input.on('pointerdown', (pointer) => { this.touchStart = { x: pointer.x, y: pointer.y }; });
    this.input.on('pointerup', (pointer) => {
      if (!this.touchStart) return;
      const dx = pointer.x - this.touchStart.x;
      const dy = pointer.y - this.touchStart.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30 && this.direction.x !== -1) this.nextDirection = { x: 1, y: 0 };
        else if (dx < -30 && this.direction.x !== 1) this.nextDirection = { x: -1, y: 0 };
      } else {
        if (dy > 30 && this.direction.y !== -1) this.nextDirection = { x: 0, y: 1 };
        else if (dy < -30 && this.direction.y !== 1) this.nextDirection = { x: 0, y: -1 };
      }
    });
  }

  spawnFood() {
    let pos;
    do {
      pos = {
        x: Phaser.Math.Between(0, this.gridSize - 1),
        y: Phaser.Math.Between(0, this.gridSize - 1)
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }

  update(time, delta) {
    if (this.gameOver) return;
    this.moveTimer += delta;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;
    this.direction = this.nextDirection;

    const head = {
      x: (this.snake[0].x + this.direction.x + this.gridSize) % this.gridSize,
      y: (this.snake[0].y + this.direction.y + this.gridSize) % this.gridSize
    };

    // Self collision
    if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
      this.gameOver = true;
      nunbaBridge.onGameComplete(this.score);
      this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
        fontSize: '32px', fill: '#FF6B6B', fontFamily: 'monospace'
      }).setOrigin(0.5).setDepth(10);
      return;
    }

    this.snake.unshift(head);

    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.scoreText.setText('Score: ' + this.score);
      this.food = this.spawnFood();
      nunbaBridge.onScoreUpdate(this.score);
      if (this.moveInterval > 60) this.moveInterval -= 2;
    } else {
      this.snake.pop();
    }

    // Draw
    const g = this.add.graphics();
    g.clear();
    g.fillStyle(0x0F0E17);
    g.fillRect(0, 0, this.scale.width, this.scale.height);

    // Grid lines
    g.lineStyle(1, 0x1a1a2e, 0.3);
    for (let i = 0; i <= this.gridSize; i++) {
      g.moveTo(i * this.cellSize, 0);
      g.lineTo(i * this.cellSize, this.gridSize * this.cellSize);
      g.moveTo(0, i * this.cellSize);
      g.lineTo(this.gridSize * this.cellSize, i * this.cellSize);
    }
    g.strokePath();

    // Food
    g.fillStyle(0xFF6B6B);
    g.fillRoundedRect(
      this.food.x * this.cellSize + 2, this.food.y * this.cellSize + 2,
      this.cellSize - 4, this.cellSize - 4, 4
    );

    // Snake
    this.snake.forEach((seg, i) => {
      g.fillStyle(i === 0 ? 0x6C63FF : 0x4a44cc);
      g.fillRoundedRect(
        seg.x * this.cellSize + 1, seg.y * this.cellSize + 1,
        this.cellSize - 2, this.cellSize - 2, 3
      );
    });
  }
}
`;

// ── Inline Breakout Scene ──
const BREAKOUT_SCENE = `
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;

    // Paddle
    this.paddle = this.add.rectangle(w / 2, h - 40, 100, 14, 0x6C63FF).setOrigin(0.5);
    this.physics.add.existing(this.paddle, false);
    this.paddle.body.setImmovable(true);
    this.paddle.body.setCollideWorldBounds(true);

    // Ball
    this.ball = this.add.circle(w / 2, h - 60, 8, 0xffffff);
    this.physics.add.existing(this.ball);
    this.ball.body.setBounce(1, 1);
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setVelocity(200, -300);

    // Bricks
    this.bricks = this.physics.add.staticGroup();
    const brickColors = [0xFF6B6B, 0xFFAB00, 0x2ECC71, 0x6C63FF, 0x00B8D9];
    const cols = 8, rows = 5;
    const brickW = (w - 20) / cols, brickH = 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const brick = this.add.rectangle(
          10 + c * brickW + brickW / 2, 60 + r * (brickH + 4),
          brickW - 4, brickH, brickColors[r]
        );
        this.physics.add.existing(brick, true);
        this.bricks.add(brick);
      }
    }

    // Collisions
    this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
    this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);

    // Touch
    this.input.on('pointermove', (pointer) => {
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 50, w - 50);
      this.paddle.body.reset(this.paddle.x, this.paddle.y);
    });

    // UI
    this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '16px', fill: '#fff' }).setDepth(10);
    this.livesText = this.add.text(w - 10, 10, 'Lives: 3', { fontSize: '16px', fill: '#FF6B6B' }).setOrigin(1, 0).setDepth(10);
  }

  hitPaddle(ball, paddle) {
    let diff = ball.x - paddle.x;
    ball.body.setVelocityX(diff * 5);
  }

  hitBrick(ball, brick) {
    brick.destroy();
    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);
    nunbaBridge.onScoreUpdate(this.score);
    if (this.bricks.countActive() === 0) {
      this.gameOver = true;
      nunbaBridge.onGameComplete(this.score);
    }
  }

  update() {
    if (this.gameOver) return;
    if (this.ball.y > this.scale.height - 10) {
      this.lives--;
      this.livesText.setText('Lives: ' + this.lives);
      nunbaBridge.onLifeLost(this.lives);
      if (this.lives <= 0) {
        this.gameOver = true;
        this.ball.body.setVelocity(0, 0);
        this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
          fontSize: '28px', fill: '#FF6B6B'
        }).setOrigin(0.5).setDepth(10);
        nunbaBridge.onGameComplete(this.score);
      } else {
        this.ball.setPosition(this.scale.width / 2, this.scale.height - 60);
        this.ball.body.setVelocity(200, -300);
      }
    }
  }
}
`;

// ── Inline Pong Scene ──
const PONG_SCENE = `
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    this.playerScore = 0;
    this.aiScore = 0;
    this.gameOver = false;

    // Paddles
    this.player = this.add.rectangle(30, h / 2, 14, 80, 0x6C63FF);
    this.ai = this.add.rectangle(w - 30, h / 2, 14, 80, 0xFF6B6B);
    this.physics.add.existing(this.player, false);
    this.physics.add.existing(this.ai, false);
    this.player.body.setImmovable(true).setCollideWorldBounds(true);
    this.ai.body.setImmovable(true).setCollideWorldBounds(true);

    // Ball
    this.ball = this.add.circle(w / 2, h / 2, 8, 0xffffff);
    this.physics.add.existing(this.ball);
    this.ball.body.setBounce(1, 1).setCollideWorldBounds(true);
    this.launchBall();

    // Colliders
    this.physics.add.collider(this.ball, this.player, this.hitPaddle, null, this);
    this.physics.add.collider(this.ball, this.ai, this.hitPaddle, null, this);

    // Touch — move player paddle
    this.input.on('pointermove', (pointer) => {
      this.player.y = Phaser.Math.Clamp(pointer.y, 40, h - 40);
      this.player.body.reset(this.player.x, this.player.y);
    });

    // Center line
    for (let y = 0; y < h; y += 20) {
      this.add.rectangle(w / 2, y, 2, 10, 0x333333);
    }

    this.scoreText = this.add.text(w / 2, 20, '0 - 0', {
      fontSize: '24px', fill: '#fff', fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(10);
  }

  launchBall() {
    const w = this.scale.width, h = this.scale.height;
    this.ball.setPosition(w / 2, h / 2);
    const angle = Phaser.Math.Between(-30, 30) * (Math.PI / 180);
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.ball.body.setVelocity(dir * 300 * Math.cos(angle), 300 * Math.sin(angle));
  }

  hitPaddle(ball, paddle) {
    let diff = (ball.y - paddle.y) / 40;
    ball.body.setVelocityY(diff * 200);
    let speed = ball.body.velocity.length();
    if (speed < 400) {
      ball.body.velocity.normalize().scale(speed + 20);
    }
  }

  update() {
    if (this.gameOver) return;
    const w = this.scale.width;

    // AI movement
    const aiTarget = this.ball.y;
    const aiSpeed = 3;
    if (this.ai.y < aiTarget - 10) this.ai.y += aiSpeed;
    else if (this.ai.y > aiTarget + 10) this.ai.y -= aiSpeed;
    this.ai.body.reset(this.ai.x, this.ai.y);

    // Score
    if (this.ball.x < 10) {
      this.aiScore++;
      this.updateScore();
      this.launchBall();
    } else if (this.ball.x > w - 10) {
      this.playerScore++;
      this.updateScore();
      nunbaBridge.onScoreUpdate(this.playerScore);
      this.launchBall();
    }
  }

  updateScore() {
    this.scoreText.setText(this.playerScore + ' - ' + this.aiScore);
    if (this.playerScore >= 11 || this.aiScore >= 11) {
      this.gameOver = true;
      this.ball.body.setVelocity(0, 0);
      const won = this.playerScore > this.aiScore;
      this.add.text(this.scale.width / 2, this.scale.height / 2,
        won ? 'YOU WIN!' : 'YOU LOSE', {
          fontSize: '32px', fill: won ? '#2ECC71' : '#FF6B6B'
        }
      ).setOrigin(0.5).setDepth(10);
      nunbaBridge.onGameComplete(this.playerScore);
    }
  }
}
`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E17',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0E17',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
  },
});

export default PhaserWebViewBridge;
