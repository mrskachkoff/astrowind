import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';
import typographyPlugin from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,json,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary:      'var(--aw-color-primary)',
        secondary:    'var(--aw-color-secondary)',
        accent:       'var(--aw-color-accent)',
        default:      'var(--aw-color-text-default)',
        muted:        'var(--aw-color-text-muted)',
        // Aurora category accents
        'acc-blue':   'var(--fds-acc-blue)',
        'acc-pink':   'var(--fds-acc-pink)',
        'acc-purple': 'var(--fds-acc-purple)',
        'acc-lime':   'var(--fds-acc-lime)',
        'acc-royal':  'var(--fds-acc-royal)',
      },
      fontFamily: {
        sans:    ['var(--aw-font-sans, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
        serif:   ['var(--aw-font-serif, ui-serif)', ...defaultTheme.fontFamily.serif],
        heading: ['var(--aw-font-heading, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
      },
      backgroundImage: {
        'grad-page':       'var(--grad-page)',
        'grad-section':    'var(--grad-section)',
        'grad-lilac':      'var(--grad-lilac)',
        'grad-chrome':     'var(--grad-chrome)',
        'grad-util':       'var(--grad-util)',
        'grad-hero':       'var(--grad-hero)',
        'grad-numbers':    'var(--grad-numbers)',
        'grad-solutions':  'var(--grad-solutions)',
        'grad-power':      'var(--grad-power)',
        'grad-footer':     'var(--grad-footer)',
        'grad-card-light': 'var(--grad-card-light)',
        'grad-card-dark':  'var(--grad-card-dark)',
        'grad-coral':      'var(--grad-coral)',
        'grad-ribbon':     'var(--grad-ribbon)',
        'aurora':          'var(--aurora)',
      },
      borderRadius: {
        pill:   'var(--fds-r-pill)',
        card:   'var(--fds-r-card)',
        figure: 'var(--fds-r-figure)',
        hero:   'var(--fds-r-hero)',
        chip:   'var(--fds-r-chip)',
      },
      boxShadow: {
        card:   'var(--fds-shadow-card)',
        figure: 'var(--fds-shadow-figure)',
        coral:  'var(--fds-shadow-coral)',
        pop:    'var(--fds-shadow-pop)',
      },
      animation: {
        fade: 'fadeInUp 1s both',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: 0, transform: 'translateY(2rem)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    typographyPlugin,
    plugin(({ addVariant }) => {
      addVariant('intersect', '&:not([no-intersect])');
    }),
  ],
  darkMode: 'class',
};
