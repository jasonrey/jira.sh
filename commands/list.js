import {
  getAccountIdForUser,
  getStoryPointsFieldId,
  listTickets,
} from '../utils/api.js';

export const listCommand = {
  command: 'list [user]',
  aliases: ['l'],
  desc: 'List tickets (defaults to you in open sprints)',
  builder: (yargs) => {
    yargs
      .positional('user', {
        describe: 'User name or email to filter by',
        type: 'string',
      })


      .option('all', {
        alias: 'a',
        describe: 'List all tickets (not just from open sprints)',
        type: 'boolean',
      })
      .option('done', {
        alias: 'd',
        describe: 'List resolved/done tickets instead of open ones',
        type: 'boolean',
      })
      .option('sort', {
        describe: 'Sort tickets by a specific field',
        type: 'string',
        choices: ['id', 'title', 'created'],
      });
  },
  handler: async (argv) => {
    try {
      let assigneeId = null;
      if (argv.user) {
        assigneeId = await getAccountIdForUser(argv.user);
      }

      const issues = await listTickets({
        assigneeId,
        showAll: argv.all,
        showDone: argv.done,
        sortBy: argv.sort,
      });

      if (issues.length === 0) {
        console.log('No tickets found.');
        return;
      }

        const spFieldId = await getStoryPointsFieldId();
        const tableData = issues.map((issue) => ({
          ID: issue.key,
          Title: issue.fields.summary,
          Points:
            spFieldId && issue.fields[spFieldId]
              ? issue.fields[spFieldId].toString()
              : 'N/A',
          Status: issue.fields.status.name,
        }));

        // Custom table formatter to mimic `column -t`
        const headers = Object.keys(tableData[0]);
        const columnWidths = {};

        // Initialize with header lengths
        headers.forEach((header) => {
          columnWidths[header] = header.length;
        });

        // Find max width for each column
        tableData.forEach((row) => {
          headers.forEach((header) => {
            const cellLength = row[header] ? row[header].length : 0;
            if (cellLength > columnWidths[header]) {
              columnWidths[header] = cellLength;
            }
          });
        });

        // Print header
        const headerLine = headers
          .map((h) => h.padEnd(columnWidths[h]))
          .join('  ');
        console.log(headerLine);

        // Print separator
        const separatorLine = headers
          .map((h) => ''.padEnd(columnWidths[h], '-'))
          .join('  ');
        console.log(separatorLine);

        // Print rows
        tableData.forEach((row) => {
          const rowLine = headers
            .map((h) => (row[h] || '').padEnd(columnWidths[h]))
            .join('  ');
          console.log(rowLine);
        });
    } catch (error) {
      console.error(`
Error: ${error.message}`);
      process.exit(1);
    }
  },
};
