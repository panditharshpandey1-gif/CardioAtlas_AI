/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ============================================================
         New design tokens — maps to CSS variables from index.css
         ============================================================ */
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        canvas:       'var(--canvas)',
        surface:      'var(--surface)',
        'surface-alt': 'var(--surface-alt)',
        border:       'var(--border)',
        'border-strong': 'var(--border-strong)',
        accent:       'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-bg':  'var(--accent-bg)',
        'risk-low':   'var(--risk-low)',
        'risk-mod':   'var(--risk-mod)',
        'risk-high':  'var(--risk-high)',
        'risk-vhigh': 'var(--risk-vhigh)',
        'viewport-bg': 'var(--viewport-bg)',
        'text-primary':   'var(--text)',
        'text-secondary': 'var(--text-2)',
        'text-tertiary':  'var(--text-3)',

        /* ============================================================
           Legacy color aliases — TODO(remove in Phase 4)
           Maps old navy/cyan/cardiac palette to new light tokens
           so src/components/heart/* and untouched views still compile.
           ============================================================ */
        navy: {
          950: 'var(--canvas)',       // was #030712 dark bg
          900: 'var(--surface-alt)',  // was #070C18
          850: 'var(--surface)',      // was #0B132B
          800: 'var(--surface)',      // was #101C3D
          750: 'var(--surface)',      // was #172554
          700: 'var(--border)',       // was #1E293B
          600: 'var(--border-strong)', // was #334155
        },
        cyan: {
          DEFAULT: 'var(--accent)',   // was #06B6D4
          glow:    'var(--accent)',   // was #22D3EE
          dark:    'var(--accent-hover)', // was #0891B2
          accent:  'var(--accent)',   // was #67E8F9
        },
        cardiac: {
          red:    'var(--risk-vhigh)', // was #F43F5E
          pulse:  'var(--risk-vhigh)', // was #EF4444
          warn:   'var(--risk-high)',  // was #F59E0B
          safe:   'var(--risk-low)',   // was #10B981
          blue:   'var(--accent)',     // was #3B82F6
          purple: '#8A3FFC',          // was #A855F7 — kept for LCX artery
        },
      },
      /* Legacy text colors — TODO(remove in Phase 4) */
      textColor: {
        slate: {
          100: 'var(--text)',
          200: 'var(--text)',
          300: 'var(--text-2)',
          400: 'var(--text-3)',
          500: 'var(--text-3)',
        },
        // Legacy specific colors used in views
        amber: {
          300: 'var(--risk-mod)',
          400: 'var(--risk-mod)',
        },
        emerald: {
          300: 'var(--risk-low)',
          400: 'var(--risk-low)',
        },
        rose: {
          300: 'var(--risk-vhigh)',
        },
        sky: {
          300: 'var(--accent)',
        },
      },
      backgroundColor: {
        /* Legacy bg aliases — TODO(remove in Phase 4) */
        slate: {
          800: 'var(--surface-alt)',
          900: 'var(--surface-alt)',
        },
      },
      borderColor: {
        /* Legacy border aliases — TODO(remove in Phase 4) */
        slate: {
          800: 'var(--border)',
          700: 'var(--border-strong)',
        },
      },
      boxShadow: {
        /* Legacy glow aliases — TODO(remove in Phase 4)
           All mapped to subtle or no shadow */
        'glow-cyan': 'none',
        'glow-cyan-lg': 'none',
        'glow-blue': 'none',
        'glow-red': 'none',
        'glow-emerald': 'none',
        'glass': '0 1px 3px 0 rgba(0,0,0,0.08)',
      },
      spacing: {
        /* 4px grid — Tailwind already uses 4px base but we add
           common clinical-UI spacing aliases */
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
      },
      borderRadius: {
        /* Brief spec: 2px inputs/buttons/tags, 4px panels */
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '4px',
        'lg': '4px',
        'xl': '4px',
        '2xl': '4px',
        /* Keep full for segmented control thumb */
        'full': '9999px',
      },
      maxWidth: {
        'content': '1280px',
      },
      animation: {
        /* No infinite animations per clinical workstation spec */
        'none': 'none',
      },
      fontSize: {
        /* Brief typography scale */
        'caption': ['12px', { lineHeight: '16px' }],
        'body':    ['14px', { lineHeight: '20px' }],
        'emph':    ['16px', { lineHeight: '24px' }],
        'section': ['20px', { lineHeight: '28px' }],
        'page':    ['28px', { lineHeight: '36px' }],
        'result':  ['40px', { lineHeight: '44px' }],
      },
    },
  },
  plugins: [],
}
