'use client';

import { useApp } from '@/context/AppContext';
import { AVATARS } from '@/constants/avatars';
import { useRouter } from 'next/navigation';
import { AdMobService } from '@/lib/admob';
import { BreakEndedModal } from '@/components/games/BreakEndedModal';
import { GameOverModal } from '@/components/games/GameOverModal';
import { LeaderboardPlacementPopup } from '@/components/games/LeaderboardPlacementPopup';
import { useEffect, useRef, useState } from 'react';

// --- Game Constants ---
const TILE_SIZE = 40;
const CANVAS_WIDTH = 360; // Logical width
const CANVAS_HEIGHT = 640; // Logical height
const MOVE_SPEED = 0.2; // Lerp factor

export default function CrossyRoadPage() {
    const { state, extendBreak, isLoading, updateHighScore, submitGameScore } = useApp();
    const router = useRouter();
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

    // Get Avatar
    const userAvatarItem = AVATARS.find(a => a.name === state.equippedAvatar);
    const userAvatarSrc = userAvatarItem ? userAvatarItem.filename : '/assets/idle.png';
    const [timeLeft, setTimeLeft] = useState(() => {
        if (state.breakTimer.endTime) {
            return Math.max(0, Math.ceil((state.breakTimer.endTime - Date.now()) / 1000));
        }
        return 0;
    });

    // Timer Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (state.breakTimer.endTime) {
                const diff = Math.ceil((state.breakTimer.endTime - Date.now()) / 1000);
                setTimeLeft(Math.max(0, diff));
                if (diff <= 0) {
                    // Timer expired. Do NOT force kill.
                }
            } else {
                setTimeLeft(0);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [state.breakTimer.endTime]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [started, setStarted] = useState(false);

    // --- Game State Refs (Mutable for Loop) ---
    const gameState = useRef({
        player: { x: 4, y: 0 }, // Logic Grid coords
        visual: { x: 4, y: 0, hop: 0 }, // Visual coords (Lerped)
        isMoving: false,
        moveStartTime: 0,
        rows: [] as Row[],
        cameraY: 0,
        maxRowReached: 0,
        avatarImg: null as HTMLImageElement | null,
        isDead: false,
        frameCount: 0,
        particles: [] as Particle[]
    });

    // --- Types ---
    type RowType = 'grass' | 'road' | 'water';
    interface Entity {
        x: number;
        w: number; // width in tiles
        speed: number;
        dir: 1 | -1;
        type: 'car' | 'log';
        color: string;
        visualOffset: number; // for bobbing logs
    }
    interface Row {
        index: number;
        type: RowType;
        entities: Entity[];
        speed?: number;
        dir?: 1 | -1;
        hasTree?: boolean; // Static obstacle
        treeX?: number;
    }
    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
        size: number;
    }

    // --- Initialization ---
    useEffect(() => {
        const img = new Image();
        img.src = userAvatarSrc;
        gameState.current.avatarImg = img;
    }, [userAvatarSrc]);

    // Game Loop
    useEffect(() => {
        // Init World
        if (gameState.current.rows.length === 0) {
            for (let i = 0; i < 20; i++) {
                spawnRow(i);
            }
        }

        let animId: number;
        const loop = () => {
            update();
            draw();
            animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(animId);
    }, []);

    // --- Core Logic ---
    const spawnRow = (index: number) => {
        const rows = gameState.current.rows;

        // Safe zone
        if (index < 3) {
            rows.push({ index, type: 'grass', entities: [] });
            return;
        }

        const r = Math.random();
        let type: RowType = 'grass';
        if (r > 0.7) type = 'water';
        else if (r > 0.35) type = 'road';

        // Difficulty scaling
        const difficulty = Math.min(1.5, 1 + (index * 0.005));

        const entities: Entity[] = [];
        let speed = 0;
        let dir: 1 | -1 = 1;
        let hasTree = false;
        let treeX = -1;

        if (type === 'road') {
            speed = (0.04 + Math.random() * 0.04) * difficulty;
            dir = Math.random() > 0.5 ? 1 : -1;
            const count = 1 + Math.floor(Math.random() * 2); // 1-2 cars
            for (let j = 0; j < count; j++) {
                // Avoid overlap
                let x = Math.random() * 9;
                if (entities.length > 0 && Math.abs(entities[0].x - x) < 3) continue;

                entities.push({
                    x,
                    w: 1.2 + Math.random() * 0.5, // slightly wider cars
                    speed,
                    dir,
                    type: 'car',
                    color: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#e67e22'][Math.floor(Math.random() * 5)],
                    visualOffset: 0
                });
            }
        } else if (type === 'water') {
            speed = (0.03 + Math.random() * 0.04) * difficulty;
            dir = Math.random() > 0.5 ? 1 : -1;
            const count = 1 + Math.floor(Math.random() * 2);
            for (let j = 0; j < count; j++) {
                let x = Math.random() * 7; // Keep within bounds initially
                if (entities.length > 0 && Math.abs(entities[0].x - x) < 4) continue;

                entities.push({
                    x,
                    w: 2 + Math.floor(Math.random() * 2), // 2-3 log width
                    speed,
                    dir,
                    type: 'log',
                    color: '#795548',
                    visualOffset: Math.random() * Math.PI * 2
                });
            }
        } else {
            // Grass - Chance for tree
            if (Math.random() > 0.3) {
                hasTree = true;
                treeX = Math.floor(Math.random() * 9);
                // Ensure tree doesn't block player at start (x=4)
                if (index < 5 && treeX === 4) hasTree = false;
            }
        }

        rows.push({ index, type, entities, speed, dir, hasTree, treeX });
        // Cleanup old rows
        if (rows.length > 40) rows.shift();
    };

    const addParticles = (x: number, y: number, color: string, count: number = 8) => {
        for (let i = 0; i < count; i++) {
            gameState.current.particles.push({
                x: x * TILE_SIZE + TILE_SIZE / 2,
                y: y, // in Screen coords potentially, but we store World Y relative particles?
                // Easier: Store world coords
                // Correct: World coords
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                color,
                size: Math.random() * 4 + 2
            });
        }
    };

    const update = () => {
        const state = gameState.current;
        if (state.isDead && started) return;

        state.frameCount++;

        // 1. Update Entities
        state.rows.forEach(row => {
            if (row.type === 'road' || row.type === 'water') {
                row.entities.forEach(ent => {
                    ent.x += ent.speed * ent.dir;
                    ent.visualOffset += 0.05; // Bobbing animation
                    // Wrap with buffer
                    if (ent.dir === 1 && ent.x > 10) ent.x = -ent.w - 1;
                    if (ent.dir === -1 && ent.x < -2) ent.x = 9 + ent.w;
                });
            }
        });

        // 2. Physics / Logic (Grid Snapped)
        const currentRow = state.rows.find(r => r.index === state.player.y);
        let onLog = false;
        let logSpeed = 0;

        if (currentRow) {
            // Wall collision check (Tree)
            if (currentRow.type === 'grass' && currentRow.hasTree && Math.round(state.player.x) === currentRow.treeX) {
                // Should have been prevented by move logic, but double check
            }

            if (currentRow.type === 'road') {
                const pBox = { x: state.player.x + 0.2, w: 0.6 };
                const hit = currentRow.entities.some(car => {
                    return (pBox.x < car.x + car.w && pBox.x + pBox.w > car.x);
                });
                if (hit) die();
            } else if (currentRow.type === 'water') {
                const pCenter = state.player.x + 0.5;
                const log = currentRow.entities.find(l => {
                    return (pCenter > l.x && pCenter < l.x + l.w);
                });
                if (log) {
                    onLog = true;
                    // Move logical player with log
                    const dx = log.speed * log.dir;
                    state.player.x += dx;
                    logSpeed = dx;
                } else if (!state.isMoving) { // Only die if not mid-hop
                    // Only die if NOT jumping
                    // Actually, simplified: Die if visual hop is low? 
                    // Or just check logic position if not moving.
                    die();
                }
            }
        }

        // 3. Visual Interpolation
        // Lerp X
        state.visual.x += (state.player.x - state.visual.x) * 0.2; // faster lerp to track log
        state.visual.y += (state.player.y - state.visual.y) * 0.15;

        // Hop Arch
        const dist = Math.sqrt(Math.pow(state.player.x - state.visual.x, 2) + Math.pow(state.player.y - state.visual.y, 2));
        if (dist > 0.1) {
            // Mid-air
            state.visual.hop = Math.sin(dist * Math.PI) * 15; // Max height 15px
        } else {
            state.visual.hop = 0;
            state.isMoving = false;
        }

        // Wall Bounds
        if (state.player.x < 0) state.player.x = 0;
        if (state.player.x > 8) state.player.x = 8;

        // 4. Camera Follow
        const targetCamY = state.player.y * TILE_SIZE - 200;
        state.cameraY += (targetCamY - state.cameraY) * 0.08;

        // 5. Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.vx;
            p.y += p.vy; // World coords? No, let's treat p.y as World Y
            p.life -= 0.05;
            if (p.life <= 0) state.particles.splice(i, 1);
        }
    };

    const die = () => {
        if (gameState.current.isDead) return;
        gameState.current.isDead = true;
        setGameOver(true);
        if (navigator.vibrate) navigator.vibrate(200);

        // Add death particles
        const s = gameState.current;
        addParticles(s.player.x, s.player.y * TILE_SIZE, '#e74c3c', 20);

        const finalScore = gameState.current.maxRowReached;
        const currentHigh = state.highScores['crossy-road'] || 0;
        if (finalScore > currentHigh) {
            setIsNewRecord(true);
            updateHighScore('crossy-road', finalScore);
        }
        submitGameScore('crossy-road', finalScore).then(rank => {
            if (rank !== null) setLeaderboardRank(rank);
        });
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#a5d6a7'; // Lighter grass
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const state = gameState.current;
        const CY = state.cameraY;
        const toScreenY = (worldY: number) => CANVAS_HEIGHT - (worldY - CY) - 100;

        // Draw Rows
        state.rows.forEach(row => {
            const y = toScreenY(row.index * TILE_SIZE);
            const h = TILE_SIZE;

            // Ground
            if (row.type === 'road') {
                ctx.fillStyle = '#546e7a';
                ctx.fillRect(0, y, CANVAS_WIDTH, h);
                // Lane Stripes
                ctx.strokeStyle = '#cfd8dc';
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(0, y + h / 2);
                ctx.lineTo(CANVAS_WIDTH, y + h / 2);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (row.type === 'water') {
                const waveOffset = Math.sin(state.frameCount * 0.05 + row.index) * 5;
                ctx.fillStyle = '#29b6f6';
                ctx.fillRect(0, y, CANVAS_WIDTH, h);
                // Simple wave detail
                ctx.fillStyle = '#81d4fa';
                ctx.fillRect(0, y + h - 5 + waveOffset / 2, CANVAS_WIDTH, 2);
            } else {
                ctx.fillStyle = '#81c784';
                if ((row.index % 2) === 0) ctx.fillStyle = '#a5d6a7'; // checkerboard grass
                ctx.fillRect(0, y, CANVAS_WIDTH, h);
            }

            // Entities
            row.entities.forEach(ent => {
                const ex = ent.x * TILE_SIZE;

                if (ent.type === 'car') {
                    // Shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(ex + 2, y + 8, ent.w * TILE_SIZE - 4, TILE_SIZE - 12);

                    // Body
                    ctx.fillStyle = ent.color;
                    // Rounded rect car body
                    ctx.fillRect(ex, y + 4, ent.w * TILE_SIZE, TILE_SIZE - 8);

                    // Roof (lighter)
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(ex + 4, y + 8, ent.w * TILE_SIZE - 8, TILE_SIZE - 16);

                    // Headlights
                    ctx.fillStyle = '#fff9c4';
                    if (ent.dir === 1) {
                        ctx.fillRect(ex + ent.w * TILE_SIZE - 4, y + 6, 4, 6);
                        ctx.fillRect(ex + ent.w * TILE_SIZE - 4, y + TILE_SIZE - 12, 4, 6);
                    } else {
                        ctx.fillRect(ex, y + 6, 4, 6);
                        ctx.fillRect(ex, y + TILE_SIZE - 12, 4, 6);
                    }
                } else if (ent.type === 'log') {
                    const bob = Math.sin(state.frameCount * 0.1 + ent.visualOffset) * 2;
                    // Log body
                    ctx.fillStyle = '#795548';
                    ctx.fillRect(ex, y + 4 + bob, ent.w * TILE_SIZE, TILE_SIZE - 8);
                    // Wood grain
                    ctx.fillStyle = '#5d4037';
                    ctx.fillRect(ex + 10, y + 8 + bob, ent.w * TILE_SIZE - 20, 2);
                    ctx.fillRect(ex + 30, y + 20 + bob, ent.w * TILE_SIZE - 50, 2);
                }
            });

            // Trees (Static)
            if (row.type === 'grass' && row.hasTree && row.treeX !== undefined) {
                const tx = row.treeX * TILE_SIZE;
                const ty = y - 10;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.ellipse(tx + TILE_SIZE / 2, ty + TILE_SIZE + 5, 14, 6, 0, 0, Math.PI * 2);
                ctx.fill();

                // Trunk
                ctx.fillStyle = '#795548';
                ctx.fillRect(tx + 12, ty + 15, 16, 25);
                // Leaves (Pine style)
                ctx.fillStyle = '#2e7d32';
                ctx.beginPath();
                ctx.moveTo(tx + 20, ty - 20);
                ctx.lineTo(tx + 40, ty + 20);
                ctx.lineTo(tx, ty + 20);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(tx + 20, ty - 5);
                ctx.lineTo(tx + 40, ty + 30);
                ctx.lineTo(tx, ty + 30);
                ctx.fill();
            }
        });

        // Effect Particles
        state.particles.forEach(p => {
            const sy = toScreenY(p.y);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, sy, p.size, p.size);
            ctx.globalAlpha = 1;
        });

        // Player
        if (!state.isDead || Math.floor(Date.now() / 200) % 2 === 0) {
            const px = state.visual.x * TILE_SIZE;
            const py = toScreenY(state.visual.y * TILE_SIZE) - state.visual.hop;

            // Shadow (shrinks when jumping)
            const shadowScale = Math.max(0.5, 1 - state.visual.hop / 30);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(px + TILE_SIZE / 2, toScreenY(state.visual.y * TILE_SIZE) + TILE_SIZE - 5, 12 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
            ctx.fill();

            if (state.avatarImg && state.avatarImg.complete) {
                ctx.drawImage(state.avatarImg, px, py - 10, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = 'white';
                ctx.fillRect(px + 10, py + 5, 20, 30);
            }
        }
    };

    // --- Controls ---
    const handleMove = (dx: number, dy: number) => {
        if (gameState.current.isDead) return;
        if (!started) setStarted(true);

        const s = gameState.current;
        const targetX = Math.round(s.player.x + dx);
        const targetY = Math.round(s.player.y + dy);

        // Bounds Check
        if (targetX < 0 || targetX > 8) return; // Wall
        if (targetY < s.maxRowReached - 3) return; // Can't go too far back

        // Wall (Tree) Check
        const targetRow = s.rows.find(r => r.index === targetY);
        if (targetRow && targetRow.hasTree && targetRow.treeX === targetX) {
            // Blocked by tree
            // Feedback shake?
            return;
        }

        s.player.x = targetX;
        s.player.y = targetY;
        s.isMoving = true;

        // Spawn particles
        addParticles(s.player.x, s.player.y * TILE_SIZE, '#fff', 4);

        if (targetY > s.maxRowReached) {
            s.maxRowReached = targetY;
            setScore(targetY);
            // Spawn ahead
            const lastIdx = s.rows[s.rows.length - 1].index;
            for (let k = 1; k <= 1; k++) spawnRow(lastIdx + k);
        }
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') handleMove(0, 1);
            if (e.key === 'ArrowDown') handleMove(0, -1);
            if (e.key === 'ArrowLeft') handleMove(-1, 0);
            if (e.key === 'ArrowRight') handleMove(1, 0);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [started, gameOver]);

    // Touch Controls
    const touchStart = useRef({ x: 0, y: 0, time: 0 });
    const handleTouchStart = (e: React.PointerEvent) => {
        touchStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    };
    const handleTouchEnd = (e: React.PointerEvent) => {
        const dx = e.clientX - touchStart.current.x;
        const dy = e.clientY - touchStart.current.y;
        if (Date.now() - touchStart.current.time < 300 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
            handleMove(0, 1); // Tap = Jump
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) handleMove(dx > 0 ? 1 : -1, 0);
        } else {
            if (Math.abs(dy) > 30) handleMove(0, dy > 0 ? -1 : 1);
        }
    };

    if (isLoading) return <div style={{ minHeight: '100vh', background: '#a5d6a7' }} />;

    return (
        <div
            style={{
                height: '100vh',
                width: '100vw',
                background: '#333',
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none'
            }}
            onPointerDown={handleTouchStart}
            onPointerUp={handleTouchEnd}
        >
            {/* HUD */}
            <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 20px)', left: 0, right: 0, padding: '0 20px', pointerEvents: 'none', zIndex: 10 }}>
                <div style={{ width: '100%', textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    <div>{score}</div>
                    <div style={{ fontSize: '1rem', color: timeLeft < 30 ? '#e74c3c' : 'white' }}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                </div>
                <button
                    className="btn"
                    style={{
                        position: 'absolute', top: 0, left: '20px',
                        background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.8)',
                        padding: '8px 16px', fontSize: '0.9rem', pointerEvents: 'auto',
                        backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                    onClick={() => router.push('/games')}
                >
                    <span>←</span> Exit
                </button>
            </div>

            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {gameOver && (
                timeLeft <= 0 ? (
                    <BreakEndedModal
                        canWatchAd={!state.breakTimer.hasClaimedAd}
                        onWatchAd={async () => {
                            await extendBreak(1);
                        }}
                        onExit={() => router.push('/study')}
                    />
                ) : (
                    <GameOverModal
                        score={score}
                        highScore={state.highScores['crossy-road'] || 0}
                        isNewRecord={isNewRecord}
                        onRestart={() => { setIsNewRecord(false); window.location.reload(); }}
                        onBackToStudy={() => router.push('/games')}
                    />
                )
            )}

            {!started && !gameOver && (
                <div style={{ position: 'absolute', top: '25%', left: '0', right: '0', textAlign: 'center', color: 'white', textShadow: '0 2px 4px black', pointerEvents: 'none' }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '10px', color: '#2ecc71', textShadow: '0 0 10px #2ecc71' }}>Buddy Cross</h1>
                    <p style={{ fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>TAP TO HOP</p>
                </div>
            )}

            {leaderboardRank !== null && (
                <LeaderboardPlacementPopup
                    rank={leaderboardRank}
                    score={score}
                    gameName="Buddy Cross"
                    onClose={() => setLeaderboardRank(null)}
                />
            )}
        </div>
    );
}
