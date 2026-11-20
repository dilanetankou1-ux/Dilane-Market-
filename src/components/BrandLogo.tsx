import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, light = false }) => {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="32"
        height="32"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="8"
          fill={light ? '#F59E0B' : '#0F1E2E'}
        />
        <path
          d="M11 11H18.5C22.6421 11 26 14.134 26 18C26 21.866 22.6421 25 18.5 25H11V11Z"
          stroke={light ? '#0F1E2E' : '#F8FAFC'}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 15L21 18L15.5 21V15Z"
          fill={light ? '#0F1E2E' : '#F59E0B'}
        />
      </svg>
      {!compact && (
        <span
          className={`font-display text-lg font-extrabold tracking-tight ${
            light ? 'text-white' : 'text-[#0F1E2E]'
          }`}
        >
          DILANE <span className="text-amber-600">MARKET</span>
        </span>
      )}
    </span>
  );
};
