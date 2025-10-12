import { getAccountIdForUser } from '../utils/api.js';

export const assigneeCommand = {
  command: 'assignee <user>',
  desc: "Look up a user's account ID by name or email",
  builder: (yargs) => {
    yargs.positional('user', {
      describe: 'The name or email of the user to look up',
      type: 'string',
    });
  },
  handler: async (argv) => {
    try {
      const userQuery = argv.user;
      console.log(`Looking up user '${userQuery}'...`);
      const accountId = await getAccountIdForUser(userQuery);
      console.log(`Account ID for ${userQuery}: ${accountId}`);
    } catch (error) {
      console.error(`
Error: ${error.message}`);
      process.exit(1);
    }
  },
};
