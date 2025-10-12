import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { markdownToAdf } from 'marklassian';
import { addComment } from '../utils/api.js';

async function getCommentFromEditor() {
  const tempFilePath = path.join(
    os.tmpdir(),
    `jira-cli-comment-${Date.now()}.md`,
  );
  await fs.writeFile(tempFilePath, ''); // Start with an empty file

  const editor = process.env.EDITOR || 'vim';

  const editorProcess = spawnSync(editor, [tempFilePath], {
    stdio: 'inherit',
  });

  if (editorProcess.status !== 0) {
    throw new Error(
      `Editor closed with status ${editorProcess.status}. Aborting comment.`,
    );
  }

  const newContent = await fs.readFile(tempFilePath, 'utf-8');
  await fs.unlink(tempFilePath);

  return newContent;
}

export const commentCommand = {
  command: 'comment <ticket-id> [text]',
  desc: 'Add a comment to a ticket. Opens an editor if text is not provided.',
  builder: (yargs) => {
    yargs
      .positional('ticket-id', {
        describe: 'The ID of the ticket to comment on',
        type: 'string',
      })
      .positional('text', {
        describe: 'The comment text. If omitted, an editor will open.',
        type: 'string',
      });
  },
  handler: async (argv) => {
    try {
      const ticketId = argv.ticketId.toUpperCase();
      let commentMd = argv.text;

      if (!commentMd) {
        console.log(
          'Opening editor... (save and close the file to post comment)',
        );
        commentMd = await getCommentFromEditor();
      }

      if (!commentMd || commentMd.trim() === '') {
        console.log('Comment is empty. Aborting.');
        return;
      }

      const payload = {
        body: markdownToAdf(commentMd),
      };

      console.log(`Adding comment to ${ticketId}...`);
      await addComment(ticketId, payload);
      console.log(`\nSuccessfully added comment to ${ticketId}.`);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  },
};
