import {
  getStoryPointsFieldId,
  getTicket,
  listTickets,
  setStoryPoints,
} from '../utils/api.js';

async function getSPField() {
  const spFieldId = await getStoryPointsFieldId();
  if (!spFieldId) {
    throw new Error("'Story Points' field not found in this Jira instance.");
  }
  return spFieldId;
}

async function handleShowPoints(ticketId) {
  const spFieldId = await getSPField();
  const ticket = await getTicket(ticketId);
  const storyPoints = ticket.fields[spFieldId] || 'Not set';
  console.log(`Story Points for ${ticketId}: ${storyPoints}`);
}

async function handleSetPoints(ticketId, points) {
  const spFieldId = await getSPField();
  const pointsNum = Number.parseInt(points, 10);
  if (Number.isNaN(pointsNum) || pointsNum < 0) {
    throw new Error('Story points must be a non-negative integer.');
  }

  await setStoryPoints(ticketId, spFieldId, pointsNum);
  console.log(
    `Successfully set Story Points to ${pointsNum} for ticket ${ticketId}.`,
  );
}

async function handleSummarizePoints() {
  const spFieldId = await getSPField();

  const openTickets = await listTickets({ showDone: false });
  const doneTickets = await listTickets({ showDone: true });

  const sumPoints = (tickets) =>
    tickets.reduce((sum, issue) => {
      const points = issue.fields[spFieldId] || 0;
      return sum + points;
    }, 0);

  const openPoints = sumPoints(openTickets);
  const donePoints = sumPoints(doneTickets);
  const totalPoints = openPoints + donePoints;

  console.log('--- Story Point Summary (Your Tickets in Open Sprints) ---');
  console.log(`  Open:   ${openPoints}`);
  console.log(`  Closed: ${donePoints}`);
  console.log(`  Total:  ${totalPoints}`);
}

export const spCommand = {
  command: 'sp [ticket-id] [points]',
  desc: 'Show or set story points, or summarize your points in open sprints',
  handler: async (argv) => {
    try {
      const { ticketId, points } = argv;

      if (ticketId && points) {
        await handleSetPoints(ticketId.toUpperCase(), points);
      } else if (ticketId) {
        await handleShowPoints(ticketId.toUpperCase());
      } else {
        await handleSummarizePoints();
      }
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
