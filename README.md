# Jira Command-Line Interface (CLI) Tool

A simple but powerful Bash script for interacting with Jira from the command line. It allows you to list, view, and create tickets, manage story points, assign tickets, and handle sprints without leaving your terminal.

## Requirements

- `bash`: The script is written for Bash.
- `curl`: Used for making API requests to Jira.
- `jq`: A command-line JSON processor, used extensively for parsing API responses.
- `pandoc` (Optional): Used for rendering ticket descriptions from HTML to Markdown for better readability. If not installed, descriptions will be rendered as plain text.

## Setup

To use the script, you need to configure two environment variables:

1.  **`JIRA_DOMAIN`**: Your full Jira domain (e.g., `your-company.atlassian.net`).

2.  **`JIRA_AUTH`**: Your Base64-encoded Jira API token. To generate this:
    a.  Create an API token for your Atlassian account [here](https://id.atlassian.com/manage-profile/security/api-tokens).
    b.  Create a string in the format `your-email@example.com:your-api-token`.
    c.  Base64-encode this string. You can use this command:
        ```sh
        echo -n 'your-email@example.com:your-api-token' | base64
        ```

Add these variables to your shell's startup file (e.g., `~/.zshrc`, `~/.bashrc`):

```sh
export JIRA_DOMAIN="your-company.atlassian.net"
export JIRA_AUTH="your-base64-encoded-string"
```

## Usage

```
./jira.sh <command> [options]
```

### Commands

| Command                 | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `list (l) [user]`       | List tickets. Defaults to you. Flags: `--short`, `--table`, `--all`, `--done`. |
| `get (g) <id> [field]`  | Show details for a ticket, or just a specific field.           |
| `create (c) "<title>"`  | Create a new ticket assigned to you in the current sprint.     |
| `done (d) <id>`         | Transition a ticket to the 'Done' status.                      |
| `sp`                    | Summarize your story points in open sprints.                   |
| `sp <id>`               | Show Story Points for a ticket.                                |
| `sp <id> <points>`      | Set the Story Points for a ticket.                             |
| `sprint (s)`            | Show active and future sprints in a table.                     |
| `sprint (s) <id> <q>`   | Assign a ticket to a sprint matching query `q`.                |
| `assign (a) <id> <user>`| Assign a ticket to a user (name or email).                     |
| `assignees [proj]`      | List assignable users for a project.                           |
| `assignee <name>`       | Look up a user's account ID by name or email.                  |
| `help (h)`              | Show the help message.                                         |

### Examples

- **List your tickets in a table:**
  ```sh
  ./jira.sh list --table
  ```

- **Get details for a ticket:**
  ```sh
  ./jira.sh get AO-123
  ```

- **Get just the description of a ticket:**
  ```sh
  ./jira.sh get AO-123 description
  ```

- **Create a new ticket:**
  ```sh
  ./jira.sh create "Deploy the new feature to production"
  ```

- **Assign a ticket to a specific sprint:**
  ```sh
  ./jira.sh sprint AO-123 "Sprint 42"
  ```

- **Set story points for a ticket:**
  ```sh
  ./jira.sh sp AO-123 8
  ```
