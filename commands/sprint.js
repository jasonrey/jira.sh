import {
  assignTicketToSprint,
  findSprintByName,
  getActiveSprint,
  getBoardId,
  getProjectKeyForTicket,
  inferProjectKey,
} from '../utils/api.js';

export const sprintCommand = {
  command: 'sprint [ticket-id] [sprint-query]',
  aliases: ['s'],
  desc: 'Show active sprint or assign a ticket to a sprint',
  handler: async (argv) => {
    try {
      const { ticketId, sprintQuery } = argv;

      if (ticketId && sprintQuery) {
        // Assign ticket to sprint
        const ticket = ticketId.toUpperCase();
        console.log(
          `Assigning ticket ${ticket} to a sprint matching '${sprintQuery}'...`,
        );

        const projectKey = await getProjectKeyForTicket(ticket);
        console.log(`Ticket belongs to project ${projectKey}.`);

        const boardId = await getBoardId(projectKey);
        console.log(`Found board ${boardId} for project.`);

        const sprint = await findSprintByName(boardId, sprintQuery);
        console.log(`Found sprint: "${sprint.name}" (ID: ${sprint.id})`);

        await assignTicketToSprint(ticket, sprint.id);
        console.log(
          `\nSuccessfully assigned ${ticket} to sprint "${sprint.name}".`,
        );
      } else if (!ticketId && !sprintQuery) {
        // Show active sprint
        console.log('Finding active sprint...');
        const projectKey = await inferProjectKey();
        const boardId = await getBoardId(projectKey);
        const sprint = await getActiveSprint(boardId);

        console.log('\n--- Active Sprint ---');
        console.log(`Name: ${sprint.name}`);
        console.log(`ID: ${sprint.id}`);
        console.log(`Goal: ${sprint.goal || 'Not set'}`);
      } else {
        console.error(
          "Invalid arguments. Use 'sprint' to see the active sprint, or 'sprint <ticket-id> <sprint-query>' to assign a ticket.",
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
