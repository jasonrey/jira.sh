import { assignTicket, getAccountIdForUser } from '../utils/api.js';

export const assignCommand = {
  command: 'assign <ticket-id> <user>',
  aliases: ['a'],
  desc: 'Assign a ticket to a user',
  builder: (yargs) => {
    yargs
      .positional('ticket-id', {
        describe: 'The ID of the ticket to assign (e.g., PROJ-123)',
        type: 'string',
      })
      .positional('user', {
        describe: 'The name or email of the user to assign the ticket to',
        type: 'string',
      });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      const userQuery = argv.user;

      console.log(`Finding user '${userQuery}'...`);
      const assigneeId = await getAccountIdForUser(userQuery);

      console.log(
        `Assigning ticket ${ticketId} to ${userQuery} (${assigneeId})...`,
      );
      await assignTicket(ticketId, assigneeId);

      console.log(
        `\nSuccessfully assigned ticket ${ticketId} to ${userQuery}.`,
      );
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
