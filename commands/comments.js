import { Parser } from 'extended-markdown-adf-parser';
import { getComments } from '../utils/api.js';

export const commentsCommand = {
  command: 'comments <ticket-id>',
  desc: 'List all comments for a ticket',
  builder: (yargs) => {
    yargs.positional('ticket-id', {
      describe: 'The ID of the ticket to list comments for',
      type: 'string',
    });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      const { comments } = await getComments(ticketId);

      if (!comments || comments.length === 0) {
        console.log('No comments found for this ticket.');
        return;
      }

      const adfParser = new Parser();

      const allComments = comments
        .map((comment) => {
          const author = comment.author.displayName;
          const d = new Date(comment.created);
          const ymd = new Intl.DateTimeFormat('en-CA').format(d);
          const hms = new Intl.DateTimeFormat(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(d);
          const tz = new Intl.DateTimeFormat(undefined, {
            timeZoneName: 'short',
          })
            .formatToParts(d)
            .find((part) => part.type === 'timeZoneName').value;
          const createdDate = `${ymd} ${hms} ${tz}`;

          const bodyMd = comment.body
            ? adfParser.adfToMarkdown(comment.body)
            : '';
          const indentedBody = bodyMd
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n');

          const header = `\x1b[33m${author} | ${createdDate}\x1b[0m`;
          return `${header}\n\n${indentedBody}`;
        })
        .join('\n\n');

      console.log(allComments);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
