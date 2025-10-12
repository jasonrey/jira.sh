import { getAssignableUsers } from '../utils/api.js';

export const assigneesCommand = {
  command: 'assignees [project-key]',
  desc: 'List assignable users for a project',
  builder: (yargs) => {
    yargs.positional('project-key', {
      describe: 'The project key (e.g., PROJ). Inferred if omitted.',
      type: 'string',
    });
  },
  handler: async (argv) => {
    try {
      const users = await getAssignableUsers(argv.projectKey);

      if (users.length === 0) {
        console.log('No assignable users found for this project.');
        return;
      }

      const tableData = users.map((user) => ({
        'Display Name': user.displayName,
        'Account ID': user.accountId,
        Email: user.emailAddress,
      }));

      console.log(
        `Assignable users for project '${argv.projectKey || 'inferred'}':`,
      );
      console.table(tableData);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
