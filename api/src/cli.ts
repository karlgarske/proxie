#!/usr/bin/env node
/**
 * Simple CLI to call HelloService.
 *
 * Examples:
 *   npx --workspace api ts-node-esm src/cli.ts hello
 *   npx --workspace api ts-node-esm src/cli.ts hello --name Alice
 */
import { Command } from 'commander';
import 'dotenv/config';
import { createHelloServiceFromEnv } from './service/HelloService.js';

const program = new Command();
program.name('api-cli').description('CLI for API service operations').version('0.1.0');

program
  .command('hello')
  .description('Return a greeting from the service')
  .option('-n, --name <name>', 'Name to greet')
  .action((opts: { name?: string }) => {
    const service = createHelloServiceFromEnv();
    const out = service.hello(opts.name);
    console.log(JSON.stringify(out, null, 2));
  });

program.parse(process.argv);

