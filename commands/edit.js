import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Parser } from 'extended-markdown-adf-parser';
import { getTicket, updateTicket } from '../utils/api.js';

async function getDescriptionFromEditor(initialContent = '') {
  const tempFilePath = path.join(os.tmpdir(), `jira-cli-edit-${Date.now()}.md`);
  await fs.writeFile(tempFilePath, initialContent);

  const editor = process.env.EDITOR || 'vim';

  const editorProcess = spawnSync(editor, [tempFilePath], {
    stdio: 'inherit',
  });

  if (editorProcess.status !== 0) {
    console.warn(
      'Editor closed without successful save. Aborting description update.',
    );
    return initialContent;
  }

  const newContent = await fs.readFile(tempFilePath, 'utf-8');
  await fs.unlink(tempFilePath);

  return newContent;
}

export const editCommand = {
  command: 'edit <ticket-id>',
  aliases: ['e'],
  desc: "Edit a ticket's fields",
  builder: (yargs) => {
    yargs
      .positional('ticket-id', {
        describe: 'The ID of the ticket to edit (e.g., PROJ-123)',
        type: 'string',
      })
      .option('title', {
        describe: 'Set a new title for the ticket',
        type: 'string',
      })
      .option('description', {
        describe:
          'Set a new description. Provide a string for a direct update, or use the flag alone to open an editor.',
      });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      const { title, description } = argv;

      if (!title && description === undefined) {
        console.error(
          'Error: You must provide a field to edit, e.g., --title "New Title" or --description',
        );
        process.exit(1);
      }

      const payload = {
        fields: {},
      };
      const adfParser = new Parser();

      if (title) {
        payload.fields.summary = title;
      }

      if (typeof description === 'string') {
        console.log('Updating description from text argument...');
        payload.fields.description =
          description.trim() === ''
            ? null
            : adfParser.markdownToAdf(description);
      } else if (description === true) {
        console.log('Fetching current description...');
        const ticket = await getTicket(ticketId);
        const initialMd = ticket.fields.description
          ? adfParser.adfToMarkdown(ticket.fields.description)
          : '';

        console.log('Opening editor... (save and close the file to continue)');
        const newMd = await getDescriptionFromEditor(initialMd);

        if (newMd.trim() === initialMd.trim()) {
          console.log('Description unchanged. Skipping update.');
        } else {
          payload.fields.description =
            newMd.trim() === '' ? null : adfParser.markdownToAdf(newMd);
        }
      }

      if (Object.keys(payload.fields).length > 0) {
        console.log(`Updating ticket ${ticketId}...`);
        await updateTicket(ticketId, payload);
        console.log(`Successfully updated ticket ${ticketId}.`);
      } else {
        console.log('No changes to apply.');
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  },
};
