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

function checkEnvVars() {
  const { JIRA_DOMAIN, JIRA_AUTH, EDITOR } = process.env;
  const envStatus = [];

  if (JIRA_DOMAIN && JIRA_AUTH) {
    envStatus.push('JIRA_DOMAIN: configured');
    envStatus.push('JIRA_AUTH: configured');
  } else {
    if (!JIRA_DOMAIN) {
      envStatus.push('JIRA_DOMAIN: not configured');
    }
    if (!JIRA_AUTH) {
      envStatus.push('JIRA_AUTH: not configured');
    }
  }

  if (EDITOR) {
    envStatus.push(`EDITOR: configured (${EDITOR})`);
  } else {
    envStatus.push('EDITOR: not configured (defaults to vim)');
  }

  return envStatus.join('\n  ');
}

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
    'la [user]',
    'Shortcut for list --all',
    listCommand.builder,
    (argv) => {
      argv.all = true;
      listCommand.handler(argv);
    },
  )
  .command(
    'ld [user]',
    'Shortcut for list --done',
    listCommand.builder,
    (argv) => {
      argv.done = true;
      listCommand.handler(argv);
    },
  )

  .demandCommand(
    1,
    'A command is required. Use --help to see available commands.',
  )
  .epilogue(`Environment Variables:
  ${checkEnvVars()}`)
  .help()
  .strict().argv;
