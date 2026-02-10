import { writeFileSync } from 'fs';

const manifest = {
  version: 1,
  routes: [
    {
      path: '/_astro/*',
      target: { kind: 'Static' },
    },
    {
      path: '/api/*',
      target: { kind: 'Compute', src: 'default' },
    },
    {
      path: '/*.*',
      target: { kind: 'Static' },
    },
    {
      path: '/*',
      target: { kind: 'Static' },
      fallback: { kind: 'Compute', src: 'default' },
    },
  ],
  computeResources: [
    {
      name: 'default',
      entrypoint: 'entry.mjs',
      runtime: 'nodejs20.x',
    },
  ],
  framework: {
    name: 'astro',
    version: '5.0.0',
  },
};

writeFileSync('.amplify-hosting/deploy-manifest.json', JSON.stringify(manifest, null, 2));
console.log('deploy-manifest.json generated');
