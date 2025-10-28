# Agentlang Resolvers For External Services

## Using Specific Resolvers

To use a specific resolver in your package.json, you can reference it directly:

### Using npm/yarn:
```json
{
  "dependencies": {
    "infoblox": "https://gitpkg.vercel.app/agentlang-hub/resolvers/{{resolvername}}?main"
  }
}
```

### Using pnpm:
```json
{
  "dependencies": {
    "infoblox": "github:agentlang-hub/resolvers#main&path:/{{resolvername}}",
  }
}
```

Where `resolvername` is the folder name of the specific resolver, such as `infoblox` or `servicenow`.
