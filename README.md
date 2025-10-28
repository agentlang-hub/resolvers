# Agentlang Resolvers For External Services

## Using Specific Resolvers

To use a specific resolver in your package.json, you can reference it directly:

### Using npm/yarn:
```json
{
  "dependencies": {
    "{{resolvername}}": "https://gitpkg.vercel.app/agentlang-hub/resolvers/{{resolvername}}?main"
  }
}
```

### Using pnpm:
```json
{
  "dependencies": {
    "{{resolvername}}": "github:agentlang-hub/resolvers#main&path:/{{resolvername}}"
  }
}
```

Where `resolvername` is the folder name of the specific resolver, such as `infoblox` or `servicenow`.
