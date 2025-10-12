import { Parser } from 'extended-markdown-adf-parser';
import { getStoryPointsFieldId, getTicket } from '../utils/api.js';

export const getCommand = {
  command: 'get <ticket-id> [field]',
  aliases: ['g'],
  desc: 'Show details for a ticket, or just a specific field',
  builder: (yargs) => {
    yargs
      .positional('ticket-id', {
        describe: 'The ID of the ticket (e.g., PROJ-123)',
        type: 'string',
      })
      .positional('field', {
        describe: 'A specific field to display (e.g., Title, Status)',
        type: 'string',
      });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      const ticket = await getTicket(ticketId);
      const spFieldId = await getStoryPointsFieldId();

      const parser = new Parser();
      const descriptionMd = ticket.fields.description
        ? parser.adfToMarkdown(ticket.fields.description)
        : 'No description found.';

      const ticketData = {
        ID: ticket.key,
        Title: ticket.fields.summary,
        URL: `https://${process.env.JIRA_DOMAIN}/browse/${ticket.key}`,
        Status: ticket.fields.status?.name,
        Assignee: ticket.fields.assignee?.displayName || 'Unassigned',
        Reporter: ticket.fields.reporter?.displayName,
        'Story Points':
          spFieldId && ticket.fields[spFieldId]
            ? ticket.fields[spFieldId].toString()
            : 'Not set',
        Comments: ticket.fields.comment?.total.toString() || '0',
        Description: descriptionMd,
      };

      // If a specific field is requested, show it and exit
      if (argv.field) {
        const fieldName = argv.field.toLowerCase();
        const keyToFind = Object.keys(ticketData).find(
          (key) => key.toLowerCase() === fieldName,
        );

        if (!keyToFind) {
          console.error(`Error: Field '${argv.field}' not found.`);
          console.error(
            `Available fields: ${Object.keys(ticketData).join(', ')}`,
          );
          process.exit(1);
        }
        console.log(ticketData[keyToFind]);
        return;
      }

      // Otherwise, display the table and description
      console.log('\n--- Ticket Details ---\n');

      // Calculate padding for alignment
      const keys = Object.keys(ticketData).filter(
        (k) => k !== 'Description' && ticketData[k],
      );
      const maxLength = Math.max(...keys.map((key) => key.length));

      keys.forEach((key) => {
        const value = ticketData[key];
        console.log(`${key.padEnd(maxLength)} : ${value}`);
      });

      console.log('\n--- Description ---\n');
      console.log(ticketData.Description);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
