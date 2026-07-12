module.exports = {
  apps: [
    {
      name: "pulsebridge-server",
      cwd: __dirname,
      script: "dist/index.js",
      args: "pulsebridge.config.json",
      node_args: "--env-file=.env",
      // Restart whenever the process exits — including POST /restart (exit 0).
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
