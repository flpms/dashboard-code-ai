# 1. Layered architecture with manual dependency injection

**Status:** accepted

## Context

Server code accumulates couplings that nothing declares: a module imports a live
database connection, reads `process.env` at load time, or grabs a singleton. Each
one is invisible in the signature and fatal to testing — the unit cannot run
without the infrastructure it silently assumed.

DI containers solve the coupling but add a second, implicit program: decorators,
registration order, and errors that surface at resolution time rather than where
the mistake was made.

## Decision

Every unit is a factory function that takes its collaborators as an argument and
returns an object of functions. One composition root per application builds the
graph, once, in explicit order.

Layers, with a one-way dependency rule: controller → use case → repository.

## Consequences

- A fake is a plain object. The test suite runs with no database and no mocking
  framework.
- The dependency list is the first line of every module, so a new coupling shows
  up in the diff.
- The composition root is long. That is the cost, and it is paid in one file
  that reads top to bottom.
- Wiring mistakes are caught by an integration test that boots the real router,
  not by the type system.
