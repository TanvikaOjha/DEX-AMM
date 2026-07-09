// components/CurveStage.js
"use client";

import React from "react";

export default function CurveStage({ reserveIn, reserveOut, amountIn, amountOut, tokenInLabel, tokenOutLabel }) {
  const W = 480;
  const H = 220;
  const PAD = 36;

  const hasReserves = reserveIn > 0 && reserveOut > 0;
  const k = hasReserves ? reserveIn * reserveOut : 1;

  // Sample the hyperbola y = k / x across a visible x-range around current reserves
  const xMin = hasReserves ? reserveIn * 0.25 : 1;
  const xMax = hasReserves ? reserveIn * 2.2 : 10;

  function toScreen(x, y) {
    const sx = PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2);
    const yMaxVal = k / xMin;
    const yMinVal = k / xMax;
    const sy = H - PAD - ((y - yMinVal) / (yMaxVal - yMinVal)) * (H - PAD * 2);
    return [sx, sy];
  }

  let pathD = "";
  if (hasReserves) {
    const steps = 60;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      const y = k / x;
      points.push(toScreen(x, y));
    }
    pathD = "M " + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
  }

  // Current pool position
  const [curX, curY] = hasReserves ? toScreen(reserveIn, reserveOut) : [PAD, H - PAD];

  // Post-trade position (if user has entered an amount)
  const hasTrade = amountIn > 0 && amountOut > 0;
  const newX = reserveIn + amountIn;
  const newY = reserveOut - amountOut;
  const [tradeX, tradeY] = hasTrade ? toScreen(newX, newY) : [curX, curY];

  return (
    <div className="w-full select-none">
      <svg 
        viewBox={`0 0 ${W} ${H}`} 
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7CFFB2" />
            <stop offset="100%" stopColor="#FF8A65" />
          </linearGradient>
          <radialGradient id="dotGlowMint" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7CFFB2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7CFFB2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dotGlowCoral" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF8A65" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FF8A65" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Axis baselines */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-white/[0.08]" strokeWidth="1" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="stroke-white/[0.08]" strokeWidth="1" />

        {/* Grid helper lines for reference frame */}
        <line x1={PAD} y1={curY} x2={W - PAD} y2={curY} className="stroke-white/[0.02]" strokeWidth="1" strokeDasharray="2 2" />
        <line x1={curX} y1={PAD} x2={curX} y2={H - PAD} className="stroke-white/[0.02]" strokeWidth="1" strokeDasharray="2 2" />

        {/* The hyperbola constant product curve line */}
        {hasReserves && (
          <path
            d={pathD}
            fill="none"
            stroke="url(#curveGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Shaded region between current and post-trade point — visualizes price impact */}
        {hasTrade && (
          <path
            d={`M ${curX},${curY} L ${tradeX},${curY} L ${tradeX},${tradeY} Z`}
            fill="#FF8A65"
            className="opacity-[0.06]"
          />
        )}

        {/* Current pool position indicator */}
        {hasReserves && (
          <>
            <circle cx={curX} cy={curY} r="16" fill="url(#dotGlowMint)" />
            <circle cx={curX} cy={curY} r="4.5" fill="#7CFFB2" className="stroke-[#050608]" strokeWidth="2" />
          </>
        )}

        {/* Post-trade projected vector lane */}
        {hasTrade && (
          <>
            <line
              x1={curX} y1={curY} x2={tradeX} y2={tradeY}
              stroke="#FF8A65" 
              strokeWidth="1.5" 
              strokeDasharray="4 4"
              className="animate-[dash_1s_linear_infinite]"
            />
            <circle cx={tradeX} cy={tradeY} r="16" fill="url(#dotGlowCoral)" />
            <circle cx={tradeX} cy={tradeY} r="4.5" fill="#FF8A65" className="stroke-[#050608]" strokeWidth="2" />
          </>
        )}

        {/* Typography Axis Labels */}
        <text 
          x={W - PAD} 
          y={H - PAD + 16} 
          textAnchor="end" 
          className="fill-gray-500 font-mono text-[9px] font-medium tracking-wide"
        >
          {tokenInLabel} Reserve →
        </text>
        <text 
          x={PAD} 
          y={PAD - 12} 
          textAnchor="start" 
          className="fill-gray-500 font-mono text-[9px] font-medium tracking-wide"
        >
          ↑ {tokenOutLabel} Reserve
        </text>
      </svg>
    </div>
  );
}