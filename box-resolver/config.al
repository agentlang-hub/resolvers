{
    "service": {
      "port": 8080,
      "httpFileHandling": true
    },
    "store": {
      "type": "#js process.env.STORE_TYPE || 'postgres'",
      "host": "#js process.env.POSTGRES_HOST || 'localhost'",
      "username": "#js process.env.POSTGRES_USER || 'postgres'",
      "password": "#js process.env.POSTGRES_PASSWORD || 'postgres'",
      "dbname": "#js process.env.POSTGRES_DB || 'test19'",
      "port": 5432
    },
    "rbac": {
      "enabled": "#js process.env.RBAC_ENABLED === 'true'"
    },
    "auth": {
      "enabled": "#js process.env.AUTH_ENABLED === 'true'"
    },
    "auditTrail": {"enabled": true}
}
  