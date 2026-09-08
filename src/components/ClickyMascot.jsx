import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../services/soundEffects';

export default function ClickyMascot({
  isSummoned,
  onToggleSummon,
  status = 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
  mousePos = { x: 0, y: 0 }
}) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const orbRef = useRef(null);

  // Natural procedural blinking
  useEffect(() => {
    let timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        const nextBlink = Math.random() * 4000 + 2500;
        timeout = setTimeout(triggerBlink, nextBlink);
      }, 160);
    };

    timeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(timeout);
  }, []);

  // Pupil cursor tracking
  useEffect(() => {
    if (!orbRef.current) return;
    const rect = orbRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = mousePos.x - centerX;
    const deltaY = mousePos.y - centerY;
    const angle = Math.atan2(deltaY, deltaX);
    const distance = Math.min(6, Math.hypot(deltaX, deltaY) / 15);

    setPupilOffset({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    });
  }, [mousePos]);

  const handleClick = (e) => {
    e.stopPropagation();
    sound.playPop();
    onToggleSummon();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    sound.playBlip();
    if (window.clickyApi) {
      window.clickyApi.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isSummoned && window.clickyApi) {
      // In electron idle mode, allow click-through outside the orb
      window.clickyApi.setIgnoreMouseEvents(false);
    }
  };

  // Determine mouth path
  const getMouthPath = () => {
    if (status === 'speaking') {
      return 'M 17 32 Q 25 40 33 32 Q 25 36 17 32'; // animated speech mouth
    }
    if (status === 'thinking') {
      return 'M 21 34 Q 25 32 29 34'; // thoughtful small mouth
    }
    if (isHovered) {
      return 'M 17 30 Q 25 41 33 30'; // big cheerful smile
    }
    return 'M 18 31 Q 25 38 32 31'; // gentle friendly curve
  };

  return (
    <div
      className="clicky-companion-anchor clicky-interactive"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title="Click to summon / hide Clicky (or press Alt + C)"
    >
      <div
        ref={orbRef}
        className={`clicky-avatar-orb ${status === 'speaking' ? 'speaking' : ''} ${
          status === 'thinking' ? 'thinking' : ''
        }`}
      >
        <div className="clicky-aura" />

        {/* Dynamic Status Dot */}
        <div className={`status-pill ${status}`} />

        {/* Animated Face */}
        <svg
          viewBox="0 0 50 50"
          className="clicky-face-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left Eye */}
          <g transform="translate(14, 18)">
            {isBlinking ? (
              <line
                x1="-6"
                y1="0"
                x2="6"
                y2="0"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <ellipse cx="0" cy="0" rx="6" ry="7.5" className="eye-outer" />
                <circle
                  cx={pupilOffset.x}
                  cy={pupilOffset.y}
                  r="3.8"
                  className="pupil"
                />
                <circle
                  cx={pupilOffset.x - 1.2}
                  cy={pupilOffset.y - 1.2}
                  r="1.2"
                  className="pupil-highlight"
                />
              </>
            )}
          </g>

          {/* Right Eye */}
          <g transform="translate(36, 18)">
            {isBlinking ? (
              <line
                x1="-6"
                y1="0"
                x2="6"
                y2="0"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <ellipse cx="0" cy="0" rx="6" ry="7.5" className="eye-outer" />
                <circle
                  cx={pupilOffset.x}
                  cy={pupilOffset.y}
                  r="3.8"
                  className="pupil"
                />
                <circle
                  cx={pupilOffset.x - 1.2}
                  cy={pupilOffset.y - 1.2}
                  r="1.2"
                  className="pupil-highlight"
                />
              </>
            )}
          </g>

          {/* Cheeks (Blush) */}
          <ellipse cx="9" cy="27" rx="3" ry="1.8" fill="rgba(244, 63, 94, 0.45)" />
          <ellipse cx="41" cy="27" rx="3" ry="1.8" fill="rgba(244, 63, 94, 0.45)" />

          {/* Expressive Mouth */}
          <path
            d={getMouthPath()}
            className="clicky-mouth"
            fill={status === 'speaking' ? '#ffffff' : 'none'}
          />
        </svg>
      </div>
    </div>
  );
}
