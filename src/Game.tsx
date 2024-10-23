// src/Game.tsx

import React, { useEffect, useRef, useState } from "react";
import { Position, Segment, Velocity } from "./types";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const cursor = cursorRef.current!;

    if (!canvas || !ctx || !cursor) return;

    let animationFrameId: number;

    // Variáveis do jogo
    let mouseX = 0;
    let mouseY = 0;

    const keys: { [key: string]: boolean } = {
      w: false,
      a: false,
      s: false,
      d: false,
    };

    const camera = {
      x: 0,
      y: 0,
    };

    // Classes

    class Snake {
      segments: Segment[];
      velocity: Velocity;
      speed: number;
      length: number;
      angle: number;
      isAI: boolean;
      baseColor: string;
      tailColor: string;
      targetFood: Food | null;
      turnSpeed: number;
      isDead: boolean;
      aggressiveness: number;
      attackRange: number;
      predatorMode: boolean;

      constructor(isAI = false) {
        this.segments = [
          { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
        ];
        this.velocity = { x: 0, y: 0 };
        this.speed = isAI ? 3.5 : 4;
        this.length = 20;
        this.angle = 0;
        this.isAI = isAI;
        this.baseColor = isAI
          ? `hsl(${Math.random() * 360}, 100%, 50%)`
          : "hsl(160, 100%, 50%)";
        this.tailColor = isAI ? this.baseColor : "hsl(160, 100%, 30%)";
        this.targetFood = null;
        this.turnSpeed = isAI ? 0.2 : 0.25;
        this.isDead = false;
        this.aggressiveness = Math.random() * 0.4 + 0.6;
        this.attackRange = 400;
        this.predatorMode = Math.random() < 0.4;
      }

      checkCollision(otherSnake: Snake): boolean {
        const headX = this.segments[0].x;
        const headY = this.segments[0].y;

        // Checa colisão com as bordas do canvas
        const margin = 10;
        if (
          headX < margin ||
          headX > canvas.width - margin ||
          headY < margin ||
          headY > canvas.height - margin
        ) {
          return true;
        }

        // Checa colisão com outro snake
        for (let i = 1; i < otherSnake.segments.length; i++) {
          const segment = otherSnake.segments[i];
          if (i < otherSnake.segments.length - 1) {
            const nextSegment = otherSnake.segments[i + 1];

            const distance = this.pointToLineDistance(
              headX,
              headY,
              segment.x,
              segment.y,
              nextSegment.x,
              nextSegment.y
            );

            if (distance < (this.isAI ? 6 : 8)) {
              return true;
            }
          }
        }
        return false;
      }

      pointToLineDistance(
        px: number,
        py: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number
      ): number {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
          param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
          xx = x1;
          yy = y1;
        } else if (param > 1) {
          xx = x2;
          yy = y2;
        } else {
          xx = x1 + param * C;
          yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
      }

      die() {
        this.isDead = true;
        // Converte o corpo da cobra em alimentos
        for (let i = 0; i < this.segments.length; i += 3) {
          foods.push(new Food(this.segments[i].x, this.segments[i].y));
        }

        // Substitui a cobra AI morta por uma nova
        if (this.isAI) {
          const index = aiSnakes.indexOf(this);
          if (index !== -1) {
            aiSnakes[index] = new Snake(true);
          }
        }
      }

      findClosestSnake(): Snake | null {
        const allSnakes = [snake, ...aiSnakes];
        let closest: Snake | null = null;
        let minDistance = Infinity;

        allSnakes.forEach((otherSnake) => {
          if (otherSnake === this || otherSnake.isDead) return;

          const distance = this.distanceTo(otherSnake.segments[0]);
          const lengthFactor = otherSnake.length < this.length ? 0.7 : 1.2;
          const adjustedDistance = distance * lengthFactor;

          if (adjustedDistance < minDistance) {
            minDistance = adjustedDistance;
            closest = otherSnake;
          }
        });

        return closest;
      }

      predictTargetPosition(target: Snake, steps = 15): Position {
        return {
          x: target.segments[0].x + target.velocity.x * steps,
          y: target.segments[0].y + target.velocity.y * steps,
        };
      }

      update(mouseX?: number, mouseY?: number) {
        if (this.isDead) return;

        if (this.isAI) {
          // Lógica de movimentação da cobra AI
          const closestSnake = this.findClosestSnake();
          const shouldAttack =
            (this.predatorMode || Math.random() < this.aggressiveness) &&
            closestSnake &&
            this.distanceTo(closestSnake.segments[0]) < this.attackRange;

          let targetX: number | undefined, targetY: number | undefined;

          if (shouldAttack && closestSnake) {
            const prediction = this.predictTargetPosition(closestSnake);
            targetX = prediction.x;
            targetY = prediction.y;

            const interceptAngle = Math.atan2(
              closestSnake.velocity.y,
              closestSnake.velocity.x
            );
            const interceptDistance = 50;
            targetX +=
              Math.cos(interceptAngle + Math.PI / 2) * interceptDistance;
            targetY +=
              Math.sin(interceptAngle + Math.PI / 2) * interceptDistance;
          } else if (!this.predatorMode) {
            if (
              !this.targetFood ||
              this.distanceTo(this.targetFood.position) < 50
            ) {
              this.targetFood = this.findClosestFood();
            }

            if (this.targetFood) {
              targetX = this.targetFood.position.x;
              targetY = this.targetFood.position.y;
            }
          } else {
            const wanderRadius = 200;
            const wanderAngle = (Date.now() / 1000) % (Math.PI * 2);
            targetX = this.segments[0].x + Math.cos(wanderAngle) * wanderRadius;
            targetY = this.segments[0].y + Math.sin(wanderAngle) * wanderRadius;
          }

          if (targetX !== undefined && targetY !== undefined) {
            const dx = targetX - this.segments[0].x;
            const dy = targetY - this.segments[0].y;
            const targetAngle = Math.atan2(dy, dx);

            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            this.angle += angleDiff * this.turnSpeed;

            this.angle += (Math.random() - 0.5) * 0.05;
          }
        } else {
          // Movimento do jogador (WASD)
          let dirX = 0;
          let dirY = 0;

          if (keys.w) dirY -= 1;
          if (keys.s) dirY += 1;
          if (keys.a) dirX -= 1;
          if (keys.d) dirX += 1;

          if (dirX !== 0 || dirY !== 0) {
            this.angle = Math.atan2(dirY, dirX);
          }
        }

        const targetVelX = Math.cos(this.angle) * this.speed;
        const targetVelY = Math.sin(this.angle) * this.speed;

        this.velocity.x += (targetVelX - this.velocity.x) * 0.3;
        this.velocity.y += (targetVelY - this.velocity.y) * 0.3;

        const newHead = {
          x: this.segments[0].x + this.velocity.x,
          y: this.segments[0].y + this.velocity.y,
        };
        this.segments.unshift(newHead);

        while (this.segments.length > this.length) {
          this.segments.pop();
        }

        // Checa colisão com as bordas
        const margin = 10;
        if (
          newHead.x < margin ||
          newHead.x > canvas.width - margin ||
          newHead.y < margin ||
          newHead.y > canvas.height - margin
        ) {
          this.die();
          if (!this.isAI) {
            setGameOver(true);
          }
          return;
        }

        // Checa colisão com outras cobras
        const allSnakes = [snake, ...aiSnakes];
        for (const otherSnake of allSnakes) {
          if (otherSnake !== this && !otherSnake.isDead) {
            if (this.checkCollision(otherSnake)) {
              this.die();
              if (!this.isAI) {
                setGameOver(true);
              }
              break;
            }
          }
        }
      }

      draw() {
        if (this.isDead) return;
        if (!ctx) return;

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        const gradient = ctx.createLinearGradient(
          this.segments[0].x,
          this.segments[0].y,
          this.segments[this.segments.length - 1].x,
          this.segments[this.segments.length - 1].y
        );
        gradient.addColorStop(0, this.baseColor);
        gradient.addColorStop(1, this.tailColor);

        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);

        for (let i = 1; i < this.segments.length - 2; i++) {
          const xc = (this.segments[i].x + this.segments[i + 1].x) / 2;
          const yc = (this.segments[i].y + this.segments[i + 1].y) / 2;
          ctx.quadraticCurveTo(this.segments[i].x, this.segments[i].y, xc, yc);
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.isAI ? 8 : 12;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        const eyeOffset = 8;
        const eyeSize = 4;
        ctx.fillStyle = "white";
        ctx.shadowColor = "white";
        ctx.shadowBlur = 10;

        if (this.isAI && this.predatorMode) {
          ctx.fillStyle = "red";
          ctx.shadowColor = "red";
        }

        ctx.beginPath();
        ctx.arc(
          this.segments[0].x + Math.cos(this.angle + 0.3) * eyeOffset,
          this.segments[0].y + Math.sin(this.angle + 0.3) * eyeOffset,
          eyeSize,
          0,
          Math.PI * 2
        );
        ctx.arc(
          this.segments[0].x + Math.cos(this.angle - 0.3) * eyeOffset,
          this.segments[0].y + Math.sin(this.angle - 0.3) * eyeOffset,
          eyeSize,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
      }

      distanceTo(point: Position): number {
        const dx = point.x - this.segments[0].x;
        const dy = point.y - this.segments[0].y;
        return Math.sqrt(dx * dx + dy * dy);
      }

      findClosestFood(): Food | null {
        return foods.reduce((closest: Food | null, food) => {
          const distance = this.distanceTo(food.position);
          if (!closest || distance < this.distanceTo(closest.position)) {
            return food;
          }
          return closest;
        }, null);
      }
    }

    class Food {
      position: Position;
      size: number;
      glowIntensity: number;
      hue: number;

      constructor(x?: number, y?: number) {
        this.position =
          x !== undefined && y !== undefined
            ? { x, y }
            : this.getRandomPosition();
        this.size = 10;
        this.glowIntensity = Math.random() * 0.5 + 0.5;
        this.hue = Math.random() * 360;
      }

      getRandomPosition(): Position {
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
        };
      }

      draw() {
        if (!ctx) return;

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 15 * this.glowIntensity;

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          this.position.x - 2,
          this.position.y - 2,
          this.size * 0.5,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, 0.5)`;
        ctx.fill();

        ctx.restore();
      }
    }

    // Inicialização
    let snake = new Snake(false);
    let aiSnakes = Array(5)
      .fill(null)
      .map(() => new Snake(true));
    let foods: Food[] = Array(100)
      .fill(null)
      .map(() => new Food());

    // Funções

    const resizeCanvas = () => {
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = true;
      }

      if (e.code === "Space" && gameOver) {
        setGameOver(false);
        setScore(0);
        snake = new Snake(false);
        aiSnakes = Array(5)
          .fill(null)
          .map(() => new Snake(true));
        foods = Array(100)
          .fill(null)
          .map(() => new Food());
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      mouseX = ((e.clientX - rect.left) * scaleX) / 2;
      mouseY = ((e.clientY - rect.top) * scaleY) / 2;
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);

    const showGameOver = () => {
      if (!ctx) return;

      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "white";
      ctx.font = "48px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2 - 50);

      ctx.font = "24px Arial";
      ctx.fillText(
        `Final Score: ${score}`,
        canvas.width / 2,
        canvas.height / 2 + 10
      );
      ctx.fillText(
        "Press Space to Restart",
        canvas.width / 2,
        canvas.height / 2 + 50
      );
      ctx.restore();
    };

    const gameLoop = () => {
      if (!ctx) return;

      const targetCameraX = snake.segments[0].x - window.innerWidth;
      const targetCameraY = snake.segments[0].y - window.innerHeight;
      camera.x += (targetCameraX - camera.x) * 0.1;
      camera.y += (targetCameraY - camera.y) * 0.1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      const gridSize = 100;

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();

      if (!gameOver) {
        snake.update(mouseX, mouseY);
        aiSnakes.forEach((aiSnake) => aiSnake.update());

        foods = foods.filter((food) => {
          let eaten = false;

          if (
            !snake.isDead &&
            snake.distanceTo(food.position) < snake.speed + food.size
          ) {
            snake.length += 2;
            setScore((prevScore) => prevScore + 10);
            eaten = true;
          }

          aiSnakes.forEach((aiSnake) => {
            if (
              !aiSnake.isDead &&
              aiSnake.distanceTo(food.position) < aiSnake.speed + food.size
            ) {
              aiSnake.length += 2;
              eaten = true;
            }
          });

          if (!eaten) {
            food.draw();
            return true;
          }
          return false;
        });

        while (foods.length < 100) {
          foods.push(new Food());
        }

        aiSnakes.forEach((aiSnake) => aiSnake.draw());
        snake.draw();
      }

      if (gameOver) {
        showGameOver();
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // Limpeza
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gameOver]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        id="gameCanvas"
        style={{
          width: "120vw",
          height: "120vh",
          marginLeft: "-10vw",
          marginTop: "-10vh",
        }}
      ></canvas>
      <div id="score">
        Score: <span>{score}</span>
      </div>
      <div ref={cursorRef} id="cursor"></div>
    </div>
  );
};

export default Game;
