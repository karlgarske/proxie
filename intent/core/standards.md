# Coding Standards

## File System

- Use lower camel case for file names (e.g., "for example" > "forExample.ts")

## Commenting

- Use at least a single line comment to summarize the purpose of a function or class
- Use inline comments to summarize the purpose of constants

## Formatting

- Refer to .prettierrc.json

## Composition

- Prioritize dependency injection using a constructor or function as needed (for testing)
- Keep classes and functions focused on a single purpose (for testing)
- Use service classes to compose and orchestrate
- Use model classes to represent persistent data types
- Use zod to validate types at runtime

## Runtime Configuration

- Use env files for non-sensitive configuration values
- Use Google Secret Manager to store and access sensitive configuration values
