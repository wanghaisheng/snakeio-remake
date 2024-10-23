// src/Game.tsx

import React, { useEffect, useRef, useState } from "react";
import { Position, Segment, Player } from "./types";
import io from "socket.io-client";

const socket = io("http://localhost:3001"); // Certifique-se de que a porta corresponde à do servidor

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [otherPlayers, setOtherPlayers] = useState<{ [id: string]: Player }>(
    {}
  );
  const [foods, setFoods] = useState<any[]>([]);

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

    // Classe Snake adaptada
    class Snake {
      segments: Segment[];
      velocity: { x: number; y: number };
      speed: number;
      length: number;
      angle: number;
      isDead: boolean;
      baseColor: string;
      tailColor: string;

      constructor(position: Position, color: string) {
        this.segments = [position];
        this.velocity = { x: 0, y: 0 };
        this.speed = 4;
        this.length = 20;
        this.angle = 0;
        this.isDead = false;
        this.baseColor = color;
        this.tailColor = "hsl(160, 100%, 30%)";
      }

      update() {
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

        // Envia o movimento para o servidor
        socket.emit("playerMovement", {
          position: this.segments[0],
          angle: this.angle,
          segments: this.segments,
          length: this.length,
        });
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
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        const eyeOffset = 8;
        const eyeSize = 4;
        ctx.fillStyle = "white";
        ctx.shadowColor = "white";
        ctx.shadowBlur = 10;

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
    }

    // Instância do Snake do jogador
    let playerSnake: Snake | null = null;

    // Dicionário de cobras dos outros jogadores
    const snakes: { [id: string]: Snake } = {};

    // Eventos do Socket.IO

    // Adicione um listener para o evento 'connect' para garantir que o socket está conectado
    socket.on("connect", () => {
      console.log("Conectado ao servidor com ID:", socket.id);
    });

    socket.on("currentPlayers", (players: { [id: string]: Player }) => {
      console.log("currentPlayers:", players);
      Object.keys(players).forEach((id) => {
        const playerData = players[id];
        if (id === socket.id) {
          // Jogador local
          playerSnake = new Snake(playerData.position, playerData.color);
          playerSnake.segments =
            playerData.segments.length > 0
              ? playerData.segments
              : [playerData.position];
        } else {
          // Outros jogadores
          const otherSnake = new Snake(playerData.position, playerData.color);
          otherSnake.segments =
            playerData.segments.length > 0
              ? playerData.segments
              : [playerData.position];
          otherSnake.length = playerData.length;
          snakes[id] = otherSnake;
        }
      });
    });

    socket.on("newPlayer", (playerData: Player) => {
      console.log("Novo jogador conectado:", playerData.id);
      if (playerData.id !== socket.id) {
        const newSnake = new Snake(playerData.position, playerData.color);
        newSnake.segments =
          playerData.segments.length > 0
            ? playerData.segments
            : [playerData.position];
        newSnake.length = playerData.length;
        snakes[playerData.id] = newSnake;
      }
    });

    socket.on("playerMoved", (playerData: Player) => {
      if (snakes[playerData.id]) {
        snakes[playerData.id].segments = playerData.segments;
        snakes[playerData.id].angle = playerData.angle;
        snakes[playerData.id].length = playerData.length;
      }
    });

    socket.on("disconnect", (id: string) => {
      console.log("Jogador desconectado:", id);
      delete snakes[id];
    });

    socket.on("currentFoods", (serverFoods: any[]) => {
      console.log("Foods recebidos do servidor");
      setFoods(serverFoods);
    });

    socket.on("removeFood", (foodId: number) => {
      setFoods((prevFoods) => prevFoods.filter((food) => food.id !== foodId));
    });

    // Funções auxiliares

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
        // Reiniciar o jogo
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
      if (!ctx || !playerSnake) {
        // console.log('Aguardando inicialização do playerSnake...');
        requestAnimationFrame(gameLoop);
        return;
      }

      const targetCameraX = playerSnake.segments[0].x - window.innerWidth;
      const targetCameraY = playerSnake.segments[0].y - window.innerHeight;
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
        playerSnake.update();

        // Desenha os alimentos
        foods.forEach((food) => {
          ctx.save();
          ctx.translate(-camera.x, -camera.y);

          ctx.shadowColor = `hsl(${food.hue}, 100%, 50%)`;
          ctx.shadowBlur = 15 * 1;
          ctx.beginPath();
          ctx.arc(food.position.x, food.position.y, food.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${food.hue}, 100%, 50%)`;
          ctx.fill();

          ctx.restore();
        });

        // Desenha os outros jogadores
        Object.keys(snakes).forEach((id) => {
          if (snakes[id]) {
            snakes[id].draw();
          }
        });

        // Desenha o jogador local
        playerSnake.draw();
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

      socket.off("connect");
      socket.off("currentPlayers");
      socket.off("newPlayer");
      socket.off("playerMoved");
      socket.off("disconnect");
      socket.off("currentFoods");
      socket.off("removeFood");
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
