{
  "version": 2,
  "crons": [
    {
      "path": "/api/cron/daily-likes",
      "schedule": "30 23 * * *"
    }
  ],
  "builds": [
    { "src": "api/index.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.js" },
    { "src": "/(.*)", "dest": "public/$1" }
  ]
}
