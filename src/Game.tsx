import React, { useEffect, useRef, useState } from "react";
import { Position, Segment, Player } from "./types";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [foods, setFoods] = useState<any[]>([]);
  const foodsRef = useRef<any[]>([]); // Referência para os alimentos

  const MAP_SIZE = 100; // Tamanho da grade do mapa em pixels
  const INITIAL_LENGTH = 20; // Tamanho inicial da cobra

  // Ref para playerSnake
  const playerSnakeRef = useRef<Snake | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    if (!canvas || !ctx) return;

    let animationFrameId: number;

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
        this.length = INITIAL_LENGTH;
        this.angle = 0;
        this.isDead = false;
        this.baseColor = color;
        this.tailColor = "hsl(160, 100%, 30%)";
      }

      reset() {
        this.segments = [{ x: canvas.width / 2, y: canvas.height / 2 }];
        this.velocity = { x: 0, y: 0 };
        this.angle = 0;
        this.isDead = false;
        this.length = INITIAL_LENGTH;
      }

      update() {
        if (this.isDead) return; // Adicionado para parar a atualização quando morto

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

        let newHeadX = this.segments[0].x + this.velocity.x;
        let newHeadY = this.segments[0].y + this.velocity.y;

        // Ajusta para o teletransporte nas bordas
        if (newHeadX < 0) newHeadX = canvas.width;
        else if (newHeadX > canvas.width) newHeadX = 0;

        if (newHeadY < 0) newHeadY = canvas.height;
        else if (newHeadY > canvas.height) newHeadY = 0;

        const newHead = { x: newHeadX, y: newHeadY };
        this.segments.unshift(newHead);

        // Ajuste para a continuidade dos segmentos ao teletransportar
        for (let i = 1; i < this.segments.length; i++) {
          const dx = this.segments[i - 1].x - this.segments[i].x;
          const dy = this.segments[i - 1].y - this.segments[i].y;

          if (Math.abs(dx) > canvas.width / 2) {
            this.segments[i].x += dx > 0 ? canvas.width : -canvas.width;
          }

          if (Math.abs(dy) > canvas.height / 2) {
            this.segments[i].y += dy > 0 ? canvas.height : -canvas.height;
          }
        }

        // Remove o excesso de segmentos
        while (this.segments.length > this.length) {
          this.segments.pop();
        }

        socket.emit("playerMovement", {
          position: this.segments[0],
          angle: this.angle,
          segments: this.segments,
          length: this.length,
        });

        // Checa se a cobra colidiu com algum alimento
        for (let i = 0; i < foodsRef.current.length; i++) {
          const food = foodsRef.current[i];
          const dist = Math.hypot(
            food.position.x - newHead.x,
            food.position.y - newHead.y
          );
          if (dist < food.size) {
            this.length += 5; // Aumenta o comprimento da cobra
            setScore((prev) => prev + 1);
            // Emite evento para o servidor
            socket.emit("eatFood", food.id);

            // Remove o alimento localmente imediatamente para evitar atraso visual
            setFoods((prevFoods) => {
              const newFoods = prevFoods.filter((f) => f.id !== food.id);
              foodsRef.current = newFoods;
              return newFoods;
            });

            break; // Sai do loop após comer um alimento
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

    const snakes: { [id: string]: Snake } = {};

    socket.on("connect", () => {
      console.log("Conectado ao servidor com ID:", socket.id);
    });

    socket.on("currentPlayers", (players: { [id: string]: Player }) => {
      Object.keys(players).forEach((id) => {
        const playerData = players[id];
        if (id === socket.id) {
          const newSnake = new Snake(playerData.position, playerData.color);
          newSnake.segments =
            playerData.segments.length > 0
              ? playerData.segments
              : [playerData.position];
          playerSnakeRef.current = newSnake;
        } else {
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
      delete snakes[id];
    });

    // Listener para 'removePlayer'
    socket.on("removePlayer", (id: string) => {
      delete snakes[id];
    });

    socket.on("currentFoods", (serverFoods: any[]) => {
      setFoods(serverFoods);
      foodsRef.current = serverFoods; // Atualiza a referência
    });

    // Listeners para 'addFood' e 'removeFood'
    socket.on("addFood", (food) => {
      setFoods((prevFoods) => {
        const newFoods = [...prevFoods, food];
        foodsRef.current = newFoods;
        return newFoods;
      });
    });

    socket.on("removeFood", (foodId) => {
      setFoods((prevFoods) => {
        const newFoods = prevFoods.filter((food) => food.id !== foodId);
        foodsRef.current = newFoods;
        return newFoods;
      });
    });

    // Listener para 'youDied'
    socket.on("youDied", () => {
      if (playerSnakeRef.current) {
        playerSnakeRef.current.isDead = true;
        setGameOver(true);
      }
    });

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = false;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    const drawGrid = () => {
      ctx.save();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += MAP_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += MAP_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const gameLoop = () => {
      const playerSnake = playerSnakeRef.current;
      if (!ctx || !playerSnake) {
        requestAnimationFrame(gameLoop);
        return;
      }

      if (gameOver) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      drawGrid();

      ctx.restore();

      playerSnake.update();

      // Use foodsRef.current para renderizar os alimentos
      foodsRef.current.forEach((food) => {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.shadowColor = `hsl(${food.hue}, 100%, 50%)`;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(food.position.x, food.position.y, food.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${food.hue}, 100%, 50%)`;
        ctx.fill();
        ctx.restore();
      });

      Object.keys(snakes).forEach((id) => {
        if (snakes[id]) {
          snakes[id].draw();
        }
      });

      playerSnake.draw();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);

      socket.off("connect");
      socket.off("currentPlayers");
      socket.off("newPlayer");
      socket.off("playerMoved");
      socket.off("disconnect");
      socket.off("currentFoods");
      socket.off("addFood");
      socket.off("removeFood");
      socket.off("removePlayer");
      socket.off("youDied");
    };
  }, [gameOver]);

  const handleRestart = () => {
    setGameOver(false);
    setScore(0);
    if (playerSnakeRef.current) playerSnakeRef.current.reset();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        id="gameCanvas"
        style={{
          width: "100%",
          height: "100%",
        }}
      ></canvas>
      <div
        id="score"
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "white",
        }}
      >
        Score: <span>{score}</span>
      </div>
      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "20px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <h1>Game Over</h1>
          <button
            onClick={handleRestart}
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              fontSize: "16px",
            }}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
};

export default Game;
