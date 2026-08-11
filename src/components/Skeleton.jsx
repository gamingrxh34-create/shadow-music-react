import React from 'react'

function Skeleton({ className = '', style = {} }) {
  return (
    <div 
      className={`rounded-md ${className} relative overflow-hidden bg-white/[0.03]`} 
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-shimmer" style={{ backgroundSize: '1000px 100%' }} />
    </div>
  )
}

export default Skeleton
