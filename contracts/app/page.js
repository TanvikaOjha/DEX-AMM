'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  // Mock data for protocol analytics - replace with your dynamic indexing/subgraph data later
  const metrics = [
    { label: 'Total Value Locked', value: '$1.42B', change: '+3.4%' },
    { label: '24h Trading Volume', value: '$284.5M', change: '+12.1%' },
    { label: 'Total Cumulative Yield Generated', value: '$48.2M', change: '' },
  ];

  const features = [
    {
      icon: (
        <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Ultra-Low Slippage AMM',
      description: 'Engineered with optimized routing algorithms to split trades across pools, minimizing price impact on large-volume swaps.',
      link: '/swap',
      cta: 'Launch Swap Interface'
    },
    {
      icon: (
        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: 'Concentrated Liquidity Pools',
      description: 'Provide liquidity within custom price ranges to drastically increase your capital efficiency and earn up to 4x higher fee shares.',
      link: '/pools',
      cta: 'Explore Active Pools'
    },
    {
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Real-Time Market Analytics',
      description: 'Track volume patterns, historical liquidity changes, and TVL depth across our native token catalog before deploying assets.',
      link: '/tokens',
      cta: 'View Token Insights'
    }
  ];

  return (
    <div className="text-gray-100 min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1a102f_0%,#09050f_60%,#030205_100%)] font-sans antialiased selection:bg-pink-500/30">
      
      {/* Global Navigation Wrapper */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex justify-between items-center backdrop-blur-md sticky top-0 z-50 border-b border-white/2">
        <div className="flex items-center space-x-3">
          <div className="bg-linear-to-r from-pink-500 to-purple-600 p-2 rounded-xl shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white via-gray-200 to-gray-500 tracking-tight">
            NexusSwap
          </span>
        </div>
        
        {/* Links point directly to your working app paths */}
        <nav className="hidden md:flex space-x-8 text-sm font-medium text-gray-400">
          <Link href="/swap" className="hover:text-pink-400 transition-colors">Swap</Link>
          <Link href="/tokens" className="hover:text-pink-400 transition-colors">Tokens</Link>
          <Link href="/pools" className="hover:text-pink-400 transition-colors">Pools</Link>
        </nav>

        <Link href="/swap">
          <button className="bg-white text-black hover:bg-gray-200 font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-md transform hover:-translate-y-0.5">
            Enter App
          </button>
        </Link>
      </header>

      {/* Hero Presentation Section */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center space-y-8">
        <div className="inline-flex items-center space-x-2 bg-pink-500/10 border border-pink-500/20 rounded-full px-4 py-1.5 text-xs text-pink-300 font-medium">
          <span>✨ Multichain Liquidity Engine Live</span>
        </div>
        
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mx-auto">
          The Decentralized Protocol For{' '}
          <span className="bg-clip-text text-transparent bg-linear-to-r from-pink-500 via-purple-400 to-indigo-400">
            Infinite Liquidity.
          </span>
        </h1>
        
        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto font-normal leading-relaxed">
          Swap assets seamlessly, pool capital efficiently, and access deep-tier yield infrastructure without intermediaries. Secure, permissionless, and open-source.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link href="/swap" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 shadow-[0_4px_20px_rgba(219,39,119,0.2)] transform hover:-translate-y-0.5">
              Start Trading Now
            </button>
          </Link>
          <Link href="/pools" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold px-8 py-4 rounded-2xl transition-all">
              Provide Liquidity
            </button>
          </Link>
        </div>
      </section>

      {/* Live Subgraph Protocol Stats Bar */}
      <section className="max-w-6xl mx-auto px-6 py-8 border-y border-white/4 bg-white/[0.01]/30 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {metrics.map((metric, idx) => (
            <div key={idx} className="space-y-1 md:px-6 md:border-r last:border-0 border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{metric.label}</p>
              <div className="flex items-baseline justify-center md:justify-start space-x-2">
                <span className="text-3xl font-bold tracking-tight text-white">{metric.value}</span>
                {metric.change && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {metric.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Functional Entry Points Feature Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Core Ecosystem Features</h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
            Direct gateways into the underlying protocol components. Pick your strategy below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {features.map((feat, index) => (
            <div 
              key={index} 
              className="group bg-[#0e0a1a]/60 border border-purple-950/40 p-8 rounded-3xl transition-all duration-300 hover:border-purple-500/30 hover:bg-[#130d24] flex flex-col justify-between hover:shadow-[0_10px_30px_rgba(147,51,234,0.05)]"
            >
              <div className="space-y-5">
                <div className="bg-white/5 w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 group-hover:scale-105 transition-transform">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-bold group-hover:text-pink-400 transition-colors">{feat.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feat.description}</p>
              </div>
              
              <div className="pt-8">
                <Link href={feat.link} className="inline-flex items-center text-xs font-semibold tracking-wider text-purple-400 uppercase group-hover:text-white transition-colors">
                  <span>{feat.cta}</span>
                  <svg className="w-3 h-3 ml-1.5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Ecosystem Map */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/3 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-400">NexusSwap Engine</span>
          <span>&copy; 2026. Fully open source.</span>
        </div>
        <div className="flex space-x-8">
          <Link href="/swap" className="hover:text-gray-300">Swap Engine</Link>
          <Link href="/pools" className="hover:text-gray-300">Pool Directory</Link>
          <Link href="/tokens" className="hover:text-gray-300">Token Performance</Link>
        </div>
      </footer>
    </div>
  );
}