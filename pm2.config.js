module.exports = {
  apps: [
    {
      name: 'auth',
      script: 'dist/auth-service/src/index.js',
      cwd: '/app/auth',
      env: { PORT: '4001', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'tenant',
      script: 'dist/tenant-service/src/index.js',
      cwd: '/app/tenant',
      env: { PORT: '4002', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'route',
      script: 'dist/route-service/src/index.js',
      cwd: '/app/route',
      env: { PORT: '4003', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'trip',
      script: 'dist/trip-service/src/index.js',
      cwd: '/app/trip',
      env: { PORT: '4004', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'livetrack',
      script: 'dist/livetrack-gateway/src/index.js',
      cwd: '/app/livetrack',
      env: { PORT: '4005', NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
