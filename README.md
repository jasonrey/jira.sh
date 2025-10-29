# Jira CLI

A modern Node.js command-line tool for interacting with Jira from the terminal. Manage tickets, story points, sprints, assignments, comments, and more without leaving your command line.

## Features

- List and view tickets with customizable filters
- Create new tickets assigned to you
- Manage story points and sprints
- Assign tickets to team members
- Add and view comments
- Edit ticket titles and descriptions
- Transition tickets to Done status
- Table-based output for better readability

## Requirements

- Node.js >= 20.0.0
- A Jira account with API access

## Installation

### Global Installation

```sh
npm install -g jira-cli
```

### Local Development

```sh
git clone https://github.com/jasonrey/jira.sh.git
cd jira.sh
npm install
npm link
```

## Setup

Configure two environment variables for authentication:

1. **`JIRA_DOMAIN`**: Your full Jira domain (e.g., `your-company.atlassian.net`)

2. **`JIRA_AUTH`**: Your Base64-encoded Jira API token. To generate this:
   - Create an API token at [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create a string in the format `your-email@example.com:your-api-token`
   - Base64-encode this string:
     ```sh
     echo -n 'your-email@example.com:your-api-token' | base64
     ```

Add these variables to your shell's startup file (e.g., `~/.zshrc`, `~/.bashrc`):

```sh
export JIRA_DOMAIN="your-company.atlassian.net"
export JIRA_AUTH="your-base64-encoded-string"
```

## Usage

```sh
jira <command> [options]
```

### Commands

| Command                     | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `list [user]`               | List tickets (defaults to your open sprint tickets)                   |
| `la [user]`                 | Shortcut for `list --all` (list all tickets)                         |
| `ld [user]`                 | Shortcut for `list --done` (list completed tickets)                  |
| `get <id> [field]`          | Show details for a ticket, or just a specific field                   |
| `create "<title>"`          | Create a new ticket assigned to you in the current sprint             |
| `done <id>`                 | Transition a ticket to the 'Done' status                              |
| `sp`                        | Summarize your story points in open sprints                           |
| `sp <id>`                   | Show Story Points for a ticket                                        |
| `sp <id> <points>`          | Set the Story Points for a ticket                                     |
| `sprint`                    | Show active and future sprints in a table                             |
| `sprint <id> <query>`       | Assign a ticket to a sprint matching query                            |
| `assign <id> <user>`        | Assign a ticket to a user (name or email)                             |
| `assignee <name>`           | Look up a user's account ID by name or email                          |
| `assignees [project]`       | List assignable users for a project                                   |
| `edit <id> [options]`       | Edit a ticket's title or description                                  |
| `comment <id> [text]`       | Add a comment to a ticket (opens editor if text not provided)         |
| `comments <id>`             | Show all comments for a ticket                                        |

### List Options

- `--all, -a`: List all tickets (not just from open sprints)
- `--done, -d`: List resolved/done tickets instead of open ones
- `--sort <field>`: Sort tickets by `id`, `title`, or `created`

### Edit Options

- `--title <text>`: Set a new title for the ticket
- `--description [text]`: Set a new description (opens editor if text not provided)

### Environment Variable for Editor

- `EDITOR`: Set your preferred editor (defaults to `vim`) for editing descriptions and comments

### Examples

#### Listing Tickets

```sh
# List your tickets in open sprints (default table view)
jira list

# List all your tickets (including closed sprints)
jira la

# List completed tickets
jira ld

# List tickets for a specific user
jira list john.doe@company.com

# Sort tickets by creation date
jira list --sort created
```

#### Viewing Tickets

```sh
# Get full details for a ticket
jira get PROJ-123

# Get just the description
jira get PROJ-123 description
```

#### Creating and Editing Tickets

```sh
# Create a new ticket
jira create "Implement user authentication feature"

# Edit ticket title
jira edit PROJ-123 --title "New improved title"

# Edit description (opens editor)
jira edit PROJ-123 --description

# Edit description directly
jira edit PROJ-123 --description "This is the new description"
```

#### Managing Story Points

```sh
# Show your story points summary
jira sp

# Show story points for a ticket
jira sp PROJ-123

# Set story points for a ticket
jira sp PROJ-123 8
```

#### Sprint Management

```sh
# Show all sprints
jira sprint

# Assign ticket to a sprint
jira sprint PROJ-123 "Sprint 42"
```

#### Assignment

```sh
# Assign ticket to a user
jira assign PROJ-123 john.doe@company.com

# Look up a user's account ID
jira assignee "John Doe"

# List all assignable users
jira assignees
```

#### Comments

```sh
# Add comment directly
jira comment PROJ-123 "This is my comment"

# Add comment using editor
jira comment PROJ-123

# View all comments
jira comments PROJ-123
```

#### Transitioning Tickets

```sh
# Mark ticket as done
jira done PROJ-123
```

## Development

```sh
# Run code quality checks (linting, formatting, type checking)
npm run checks
```

## License

ISC

## Author

Jason Rey <jasonrey@outlook.com>

## Repository

[https://github.com/jasonrey/jira.sh](https://github.com/jasonrey/jira.sh)
