import React, { useState, useEffect, useRef, useId } from 'react';
import { BotEngine } from '../bot/engine.js';
import { DEMI_VIEWBOX, RAYON } from '../bot/repere.js';
import { sound } from '../services/soundEffects';

export default function BlobMascot({
  isSummoned,
  onToggleSummon,
  status = 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
  size = 84,
  interactive = true,
  title = 'Click to talk, or drag to move Blob AI anywhere on screen'
}) {
  const [frame, setFrame] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const engineRef = useRef(null);
  const startTimeRef = useRef(performance.now());
  const rafRef = useRef(null);
  const idleLookTimerRef = useRef(null);
  const dragStartRef = useRef({ screenX: 0, screenY: 0, hasMoved: false });
  const containerRef = useRef(null);

  const uniqueId = useId().replace(/[:]/g, '');
  const clipId = `blob-body-clip-${uniqueId}`;

  // Initialize procedural engine
  useEffect(() => {
    engineRef.current = new BotEngine(RAYON, 'idle');
    startTimeRef.current = performance.now();

    const loop = () => {
      if (engineRef.current) {
        const now = (performance.now() - startTimeRef.current) / 1000;
        const currentFrame = engineRef.current.sample(now);
        setFrame(currentFrame);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // React to status changes
  useEffect(() => {
    if (!engineRef.current) return;
    const now = (performance.now() - startTimeRef.current) / 1000;

    if (status === 'thinking') {
      engineRef.current.setState('orbit', now);
    } else if (status === 'speaking') {
      engineRef.current.setState('wide', now);
    } else if (status === 'listening') {
      engineRef.current.setState('attentif', now);
    } else {
      engineRef.current.setState('idle', now);
    }
  }, [status]);

  // Global Cursor Tracking across entire Windows screen (Electron IPC)
  useEffect(() => {
    const handleCursorMovement = (relX, relY) => {
      if (!engineRef.current) return;
      const now = (performance.now() - startTimeRef.current) / 1000;

      // Normalize cursor offsets across screen
      const nx = Math.max(-1, Math.min(1, relX / 380));
      const ny = Math.max(-1, Math.min(1, relY / 280));

      // Map to 3D sphere yaw & pitch
      const yaw = nx * 20;
      const pitch = -ny * 16; // Invert y because screen y increases downwards

      engineRef.current.setLook(
        {
          yaw,
          pitch,
          mix: 1, // Focus look target on cursor
          spin: 0,
          wander: 0 // Inhibit wander while cursor is active
        },
        now
      );

      // Restore natural wander, micro-saccades and blinking after cursor settles
      if (idleLookTimerRef.current) clearTimeout(idleLookTimerRef.current);
      idleLookTimerRef.current = setTimeout(() => {
        if (!engineRef.current) return;
        const idleNow = (performance.now() - startTimeRef.current) / 1000;
        engineRef.current.setLook(
          {
            yaw: 0,
            pitch: 0,
            mix: 0, // Release look override
            spin: 0,
            wander: 1 // Full natural wander
          },
          idleNow
        );
      }, 1200);
    };

    if (window.clickyApi?.onGlobalCursorTrack) {
      const cleanup = window.clickyApi.onGlobalCursorTrack(({ relX, relY }) => {
        handleCursorMovement(relX, relY);
      });
      return cleanup;
    }

    // Browser dev fallback
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      handleCursorMovement(relX, relY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (idleLookTimerRef.current) clearTimeout(idleLookTimerRef.current);
    };
  }, []);

  // Desktop Dragging Logic
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragStartRef.current = {
      screenX: e.screenX,
      screenY: e.screenY,
      hasMoved: false
    };
    setIsDragging(true);

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.screenX - dragStartRef.current.screenX;
      const deltaY = moveEvent.screenY - dragStartRef.current.screenY;

      if (Math.hypot(deltaX, deltaY) > 3) {
        dragStartRef.current.hasMoved = true;
      }

      if (dragStartRef.current.hasMoved && window.clickyApi?.dragWindow) {
        window.clickyApi.dragWindow(deltaX, deltaY);
        dragStartRef.current.screenX = moveEvent.screenX;
        dragStartRef.current.screenY = moveEvent.screenY;
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      // If user merely clicked without dragging, toggle the chat HUD
      if (!dragStartRef.current.hasMoved) {
        sound.playPop();
        onToggleSummon();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    sound.playBlip();
    if (window.clickyApi?.setIgnoreMouseEvents) {
      window.clickyApi.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const VB = DEMI_VIEWBOX;

  return (
    <div
      ref={containerRef}
      className={`blob-mascot-anchor ${interactive ? 'clicky-interactive' : ''} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={interactive ? handleMouseDown : undefined}
      onMouseEnter={interactive ? handleMouseEnter : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      title={title}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default'
      }}
    >
      <div
        className={`blob-character-wrap ${status} ${isHovered ? 'hovered' : ''}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {frame ? (
          <svg
            viewBox={`-${VB} -${VB} ${VB * 2} ${VB * 2}`}
            width={size}
            height={size}
            className="blob-svg-mascot"
            style={{
              overflow: 'visible',
              filter: size > 50 ? 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45))' : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          >
            <defs>
              {/* Clip path from body silhouette so eyes clip mathematically */}
              <clipPath id={clipId}>
                <path d={frame.bodyPath} />
              </clipPath>

              {/* Arc linear gradients for celestial orbit rings */}
              {frame.arcs.map((arc) => (
                <linearGradient
                  key={arc.id}
                  id={`grad-${uniqueId}-${arc.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={arc.grad.x1}
                  y1={arc.grad.y1}
                  x2={arc.grad.x2}
                  y2={arc.grad.y2}
                >
                  {arc.grad.stops.map((c, i) => (
                    <stop
                      key={i}
                      offset={i / (arc.grad.stops.length - 1)}
                      stopColor={c}
                    />
                  ))}
                </linearGradient>
              ))}
            </defs>

            {/* Back half of orbit rings (rendered behind the body) */}
            <g fill="none" strokeLinecap="round">
              {frame.arcs.map((arc) => (
                <path
                  key={`back-${arc.id}`}
                  d={arc.back}
                  stroke={`url(#grad-${uniqueId}-${arc.id})`}
                  strokeWidth={arc.width}
                  opacity={arc.opacity}
                />
              ))}
            </g>

            {/* Dots behind body */}
            {frame.dotsBehind &&
              frame.dots.map((dot, i) =>
                dot.d ? (
                  <path
                    key={`dot-b-${i}`}
                    d={dot.d}
                    transform={`translate(${dot.x}, ${dot.y}) rotate(${dot.rot || 0})`}
                    fill="#0a0a0c"
                    opacity={dot.opacity}
                  />
                ) : (
                  <circle
                    key={`dot-b-${i}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.r}
                    fill="#0a0a0c"
                    opacity={dot.opacity}
                  />
                )
              )}

            {/* Blob Body & Eyes */}
            <g opacity={frame.bodyAlpha}>
              {/* Pure dark ink silhouette */}
              <path d={frame.bodyPath} fill="#0a0a0c" />

              {/* Mathematically projected capsule eyes clipped to body */}
              <g clipPath={`url(#${clipId})`}>
                {frame.eyes.map((eye, i) => (
                  <path
                    key={`eye-${i}`}
                    d={eye.d}
                    transform={eye.matrix}
                    fill="#f7f8fa"
                    opacity={eye.alpha}
                  />
                ))}
              </g>
            </g>

            {/* Dots in front of body */}
            {!frame.dotsBehind &&
              frame.dots.map((dot, i) =>
                dot.d ? (
                  <path
                    key={`dot-f-${i}`}
                    d={dot.d}
                    transform={`translate(${dot.x}, ${dot.y}) rotate(${dot.rot || 0})`}
                    fill="#0a0a0c"
                    opacity={dot.opacity}
                  />
                ) : (
                  <circle
                    key={`dot-f-${i}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.r}
                    fill="#0a0a0c"
                    opacity={dot.opacity}
                  />
                )
              )}

            {/* Notification pastille if active */}
            {frame.notif && (
              <circle
                cx={frame.notif.x}
                cy={frame.notif.y}
                r={frame.notif.r}
                fill="#2496e8"
              />
            )}

            {/* Front half of orbit rings (rendered in front of body) */}
            <g fill="none" strokeLinecap="round">
              {frame.arcs.map((arc) => (
                <path
                  key={`front-${arc.id}`}
                  d={arc.front}
                  stroke={`url(#grad-${uniqueId}-${arc.id})`}
                  strokeWidth={arc.width}
                  opacity={arc.opacity}
                />
              ))}
            </g>
          </svg>
        ) : null}
      </div>
    </div>
  );
}
