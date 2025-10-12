import {
  createTicket,
  getActiveSprint,
  getBoardId,
  getCurrentUser,
  getSprintFieldId,
  inferProjectKey,
} from '../utils/api.js';

export const createCommand = {
  command: 'create <title>',
  aliases: ['c'],
  desc: 'Create a new ticket assigned to you',
  builder: (yargs) => {
    yargs
      .positional('title', {
        describe: 'The title of the ticket',
        type: 'string',
      })
      .option('project', {
        alias: 'p',
        describe: 'The project key (e.g., PROJ). Inferred if omitted.',
        type: 'string',
      });
  },
  handler: async (argv) => {
    try {
      const assigneeId = await getCurrentUser();

      const projectKey = argv.project
        ? argv.project.toUpperCase()
        : await inferProjectKey();
      console.log(`Using project: ${projectKey}`);

      let sprintInfo = {};
      try {
        const boardId = await getBoardId(projectKey);
        const activeSprint = await getActiveSprint(boardId);
        const sprintFieldId = await getSprintFieldId();
        if (activeSprint && sprintFieldId) {
          sprintInfo = {
            sprintId: activeSprint.id,
            sprintFieldId,
            sprintName: activeSprint.name,
          };
        }
      } catch (sprintError) {
        console.warn(
          `Warning: Could not find an active sprint to assign the ticket to. ${sprintError.message}`,
        );
      }

      console.log('Creating ticket...');
      const newTicket = await createTicket({
        title: argv.title,
        projectKey: projectKey,
        assigneeId,
        sprintId: sprintInfo.sprintId,
        sprintFieldId: sprintInfo.sprintFieldId,
      });

      console.log(`\nSuccessfully created ticket: ${newTicket.key}`);
      console.log(`  Title: ${argv.title}`);
      console.log(
        `  URL: https://${process.env.JIRA_DOMAIN}/browse/${newTicket.key}`,
      );
      if (sprintInfo.sprintId) {
        console.log(`  Assigned to sprint: "${sprintInfo.sprintName}"`);
      }
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
