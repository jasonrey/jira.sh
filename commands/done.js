import { getTransitionIdByName, transitionTicket } from '../utils/api.js';

export const doneCommand = {
  command: 'done <ticket-id>',
  aliases: ['d'],
  desc: "Transition a ticket to the 'Done' status",
  builder: (yargs) => {
    yargs.positional('ticket-id', {
      describe: 'The ID of the ticket to close (e.g., PROJ-123)',
      type: 'string',
    });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      console.log(`Finding 'Done' transition for ${ticketId}...`);

      const transitionId = await getTransitionIdByName(ticketId, 'Done');

      console.log(`Transitioning ${ticketId} to Done...`);
      await transitionTicket(ticketId, transitionId);

      console.log(`
Ticket ${ticketId} successfully transitioned to Done.`);
    } catch (error) {
      console.error(`
Error: ${error.message}`);
      process.exit(1);
    }
  },
};
