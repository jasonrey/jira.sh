#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { assignCommand } from './commands/assign.js';
import { assigneeCommand } from './commands/assignee.js';
import { assigneesCommand } from './commands/assignees.js';
import { commentCommand } from './commands/comment.js';
import { commentsCommand } from './commands/comments.js';
import { createCommand } from './commands/create.js';
import { doneCommand } from './commands/done.js';
import { editCommand } from './commands/edit.js';
import { getCommand } from './commands/get.js';
import { listCommand } from './commands/list.js';
import { spCommand } from './commands/sp.js';
import { sprintCommand } from './commands/sprint.js';

yargs(hideBin(process.argv))
  .command(getCommand)
  .command(listCommand)
  .command(createCommand)
  .command(doneCommand)
  .command(assignCommand)
  .command(assigneeCommand)
  .command(assigneesCommand)
  .command(sprintCommand)
  .command(spCommand)
  .command(editCommand)
  .command(commentCommand)
  .command(commentsCommand)
  .command(
    'ls [user]',
    'Shortcut for list --short',
    listCommand.builder,
    (argv) => {
      argv.short = true;
      listCommand.handler(argv);
    },
  )
  .command(
    'la [user]',
    'Shortcut for list --all',
    listCommand.builder,
    (argv) => {
      argv.all = true;
      listCommand.handler(argv);
    },
  )
  .command(
    'lt [user]',
    'Shortcut for list --table',
    listCommand.builder,
    (argv) => {
      argv.table = true;
      listCommand.handler(argv);
    },
  )
  .demandCommand(
    1,
    'A command is required. Use --help to see available commands.',
  )
  .help()
  .strict().argv;
