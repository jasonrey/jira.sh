import 'node:process';

function getJiraAuth() {
  const { JIRA_DOMAIN, JIRA_AUTH } = process.env;

  if (!JIRA_DOMAIN || !JIRA_AUTH) {
    throw new Error(
      'Missing required environment variables: JIRA_DOMAIN or JIRA_AUTH',
    );
  }
  return {
    domain: JIRA_DOMAIN,
    headers: {
      Authorization: `Basic ${JIRA_AUTH}`,
      Accept: 'application/json',
    },
  };
}

const SPRINT_CACHE_PATH = path.join(
  os.tmpdir(),
  'jira_cli_sprint_field_id.txt',
);

export async function getSprintFieldId() {
  try {
    const cachedId = await fs.readFile(SPRINT_CACHE_PATH, 'utf-8');
    if (cachedId) return cachedId.trim();
  } catch (_e) {
    // Cache file doesn't exist, proceed to fetch.
  }

  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/field`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Could not fetch fields: ${response.statusText}`);
  }
  const fields = await response.json();
  const sprintField = fields.find((f) => f.name.toLowerCase() === 'sprint');

  if (!sprintField) {
    return null;
  }

  await fs.writeFile(SPRINT_CACHE_PATH, sprintField.id);
  return sprintField.id;
}

export async function setStoryPoints(ticketId, fieldId, points) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}`;

  const payload = {
    fields: {
      [fieldId]: points,
    },
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error setting story points for ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
}

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SP_CACHE_PATH = path.join(os.tmpdir(), 'jira_cli_sp_id.txt');

export async function getStoryPointsFieldId() {
  try {
    const cachedId = await fs.readFile(SP_CACHE_PATH, 'utf-8');
    if (cachedId) return cachedId.trim();
  } catch (_e) {
    // Cache file doesn't exist or is unreadable, proceed to fetch.
  }

  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/field`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Could not fetch fields: ${response.statusText}`);
  }
  const fields = await response.json();
  const spField = fields.find((f) =>
    /^story.?points?( estimate)?$/i.test(f.name),
  );

  if (!spField) {
    // Don't throw an error, as not all projects use story points.
    // Return null and let the calling function handle it.
    return null;
  }

  await fs.writeFile(SP_CACHE_PATH, spField.id);
  return spField.id;
}

export async function getProjectKeyForTicket(ticketId) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}?fields=project`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Could not get project key for ticket ${ticketId}. Status: ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data.fields.project.key;
}

export async function getActiveSprint(boardId) {
  const { domain, headers } = getJiraAuth();
  const agileUrl = `https://${domain}/rest/agile/1.0`;
  const url = `${agileUrl}/board/${boardId}/sprint?state=active`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Could not get active sprint for board ${boardId}. Status: ${response.statusText}`,
    );
  }
  const data = await response.json();
  if (!data.values || data.values.length === 0) {
    throw new Error(`No active sprint found for board ${boardId}`);
  }
  return data.values[0];
}

export async function findSprintByName(boardId, sprintName) {
  const { domain, headers } = getJiraAuth();
  const agileUrl = `https://${domain}/rest/agile/1.0`;
  const url = `${agileUrl}/board/${boardId}/sprint`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Could not get sprints for board ${boardId}. Status: ${response.statusText}`,
    );
  }
  const data = await response.json();
  const matchingSprints = data.values.filter((s) =>
    s.name.toLowerCase().includes(sprintName.toLowerCase()),
  );

  if (matchingSprints.length === 0) {
    throw new Error(`No sprint found matching '${sprintName}'`);
  }
  if (matchingSprints.length > 1) {
    const sprintNames = matchingSprints.map((s) => s.name).join(', ');
    throw new Error(
      `Multiple sprints match your query: ${sprintNames}. Please be more specific.`,
    );
  }

  return matchingSprints[0];
}

export async function assignTicketToSprint(ticketId, sprintId) {
  const { domain, headers } = getJiraAuth();
  const agileUrl = `https://${domain}/rest/agile/1.0`;
  const url = `${agileUrl}/sprint/${sprintId}/issue`;

  const payload = {
    issues: [ticketId],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error assigning ticket ${ticketId} to sprint ${sprintId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
}

export async function getBoardId(projectKey) {
  const { domain, headers } = getJiraAuth();
  const agileUrl = `https://${domain}/rest/agile/1.0`;

  const url = `${agileUrl}/board?projectKeyOrId=${projectKey}`;
  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Could not find board for project ${projectKey}. Status: ${response.statusText}`,
    );
  }

  const data = await response.json();
  if (!data.values || data.values.length === 0) {
    throw new Error(`No boards found for project ${projectKey}`);
  }

  return data.values[0].id;
}

export async function inferProjectKey() {
  const { domain, headers } = getJiraAuth();
  // Find the most recently updated ticket for the current user to infer the project
  const url = `https://${domain}/rest/api/3/search/jql?jql=assignee%20in%20(currentUser())%20ORDER%20BY%20updated%20DESC&fields=project&maxResults=1`;

  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to infer project key: ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.issues || data.issues.length === 0) {
    throw new Error('Could not infer project. Please specify a project key.');
  }
  return data.issues[0].fields.project.key;
}

export async function getAssignableUsers(projectKey) {
  const { domain, headers } = getJiraAuth();

  let project = projectKey;

  if (!projectKey) {
    console.log(
      'No project key provided, attempting to infer from your recent tickets...',
    );
    project = await inferProjectKey();
    console.log(`Inferred project: ${project}\n`);
  }

  const url = `https://${domain}/rest/api/3/user/assignable/search?project=${project}`;
  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Could not retrieve assignees for project '${project}'. Status: ${response.statusText}`,
    );
  }

  return response.json();
}

export async function assignTicket(ticketId, assigneeId) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}`;

  const payload = {
    fields: {
      assignee: {
        accountId: assigneeId,
      },
    },
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error assigning ticket ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
}

export async function getTransitionIdByName(ticketId, transitionName) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}/transitions`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching transitions for ${ticketId}: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const transition = data.transitions.find(
    (t) => t.name.toLowerCase() === transitionName.toLowerCase(),
  );

  if (!transition) {
    throw new Error(
      `Could not find transition '${transitionName}' for ticket ${ticketId}`,
    );
  }

  return transition.id;
}

export async function transitionTicket(ticketId, transitionId) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}/transitions`;

  const payload = {
    transition: {
      id: transitionId,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error transitioning ticket ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
}

export async function createTicket({
  title,
  projectKey,
  assigneeId,
  sprintId,
  sprintFieldId,
}) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue`;

  const payload = {
    fields: {
      project: {
        key: projectKey,
      },
      summary: title,
      issuetype: {
        name: 'Task',
      },
      assignee: {
        accountId: assigneeId,
      },
    },
  };

  if (sprintId && sprintFieldId) {
    payload.fields[sprintFieldId] = sprintId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error creating ticket: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  return response.json();
}

export async function getCurrentUser() {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/myself`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching current user: ${response.status} ${response.statusText}`,
    );
  }

  const me = await response.json();
  return me.accountId;
}

export async function getComments(ticketId) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}/comment`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error getting comments for ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
  return response.json();
}

export async function addComment(ticketId, payload) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}/comment`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error adding comment to ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
  return response.json();
}

export async function updateTicket(ticketId, payload) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/issue/${ticketId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error updating ticket ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }
  // A 204 No Content response is a success
}

export async function listTickets({ assigneeId, showAll, showDone, sortBy }) {
  const { domain, headers } = getJiraAuth();

  let jql = '';
  if (assigneeId) {
    jql += `assignee = '${assigneeId}'`;
  } else {
    jql += 'assignee in (currentUser())';
  }

  if (showDone) {
    jql += ' AND resolution is not EMPTY';
  } else {
    jql += ' AND resolution is EMPTY';
  }

  if (!showAll) {
    jql += ' AND sprint in openSprints()';
  }

  const sortMap = {
    id: 'key',
    title: 'summary',
    created: 'created',
  };

  if (sortBy && sortMap[sortBy]) {
    jql += ` ORDER BY ${sortMap[sortBy]} ASC`;
  } else {
    jql += ' ORDER BY updated DESC';
  }

  const fields = ['key', 'summary', 'status'];
  const spFieldId = await getStoryPointsFieldId();
  if (spFieldId) {
    fields.push(spFieldId);
  }

  const url = `https://${domain}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error fetching tickets: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  const result = await response.json();
  return result.issues || [];
}

export async function getAccountIdForUser(query) {
  const { domain, headers } = getJiraAuth();
  const url = `https://${domain}/rest/api/3/user/search?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Error searching for user '${query}': ${response.status} ${response.statusText}`,
    );
  }

  const users = await response.json();
  if (!users || users.length === 0) {
    throw new Error(`No user found matching '${query}'`);
  }

  return users[0].accountId;
}

export async function getTicket(ticketId) {
  const { domain, headers } = getJiraAuth();
  const fields = [
    'summary',
    'status',
    'assignee',
    'reporter',
    'comment',
    // Add story points field if it exists
    await getStoryPointsFieldId(),
  ]
    .filter(Boolean)
    .join(',');

  const url = `https://${domain}/rest/api/3/issue/${ticketId}?fields=${fields}`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error fetching ticket ${ticketId}: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  return response.json();
}
