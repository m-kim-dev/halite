# Welcome to the project

This little project exercises the features a documentation reader needs.

## Start reading

- [Reading guide](guide.md)
- [Architecture](architecture.md)
- [Equations](math.md)
- [A file with spaces](A%20file.md)
- [Source example](../example.py)
- [Empty directory](notes/)

## Reading principles

Keep your documents where they belong. Follow links, explore folders, and return
to your reading position.

| Feature | Expected behavior |
| --- | --- |
| Navigation | Relative links stay inside the reader |
| Rendering | Code, tables, diagrams, and math remain readable |
| Editing | Documents stay read-only |

```typescript
const documentation = { mode: 'read-only', location: 'your project' };
console.log(documentation);
```

> Your project files are the source of truth.
