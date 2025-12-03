import type { HoveredBar } from '../types';

declare const window: any;

type TooltipProps = {
  hoveredBar: HoveredBar | null;
  mousePos: { x: number; y: number };
};

export function Tooltip({ hoveredBar, mousePos }: TooltipProps): JSX.Element | null {
  if (!hoveredBar) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(mousePos.x + 12, window.innerWidth - 620),
        top: Math.min(mousePos.y + 12, window.innerHeight - 200),
        background: 'var(--popover-bg)',
        border: '1px solid var(--popover-border)',
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text-primary)',
        fontSize: 13,
        whiteSpace: 'pre-wrap',
        zIndex: 1000,
        maxWidth: 600,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
      }}
    >
      {hoveredBar.content}
    </div>
  );
}

type LoadingSpinnerProps = {
  visible: boolean;
};

export function LoadingSpinner({ visible }: LoadingSpinnerProps): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--border-primary)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        Loading data as per AP...
      </div>
    </div>
  );
}
