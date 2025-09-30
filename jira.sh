#!/bin/bash

# Jira CLI tool
# Required environment variables:
# - JIRA_AUTH: Base64 encoded basic auth (email:api_token)
# - JIRA_DOMAIN: Your Jira domain (e.g., yourcompany.atlassian.net)

# Check required environment variables
if [[ -z "$JIRA_DOMAIN" || -z "$JIRA_AUTH" ]]; then
    echo "Error: Missing required environment variables:"
    echo "  JIRA_DOMAIN - Your Jira domain (e.g., yourcompany.atlassian.net)"
    echo "  JIRA_AUTH   - Base64 encoded basic auth (email:api_token)"
    exit 1
fi

BASE_URL="https://${JIRA_DOMAIN}/rest/api/3"

# Function to dynamically find and cache the Story Points field ID
get_story_points_field_id() {
    local cache_file="/tmp/jira_cli_sp_id.txt"
    if [[ -f "$cache_file" ]]; then
        cat "$cache_file"
        return
    fi

    local field_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                          -H "Accept: application/json" \
                          "${BASE_URL}/field" | \
                     jq -r '.[] | select(.name | test("^story.?points?( estimate)?$"; "i")) | .id')

    if [[ -n "$field_id" ]]; then
        echo "$field_id" > "$cache_file"
        echo "$field_id"
    else
        return
    fi
}

# Function to dynamically find and cache the Sprint field ID
get_sprint_field_id() {
    local cache_file="/tmp/jira_cli_sprint_field_id.txt"
    if [[ -f "$cache_file" ]]; then
        cat "$cache_file"
        return
    fi

    local field_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                          -H "Accept: application/json" \
                          "${BASE_URL}/field" | \
                     jq -r '.[] | select(.name == "Sprint") | .id')

    if [[ -n "$field_id" ]]; then
        echo "$field_id" > "$cache_file"
        echo "$field_id"
    else
        return
    fi
}

# Function to get the raw JSON of tickets for a given account ID
get_sprint_tickets_json_for_account() {
    local account_id="$1"
    local show_all="$2"
    local show_done="$3"
    local sp_field_id=$(get_story_points_field_id)
    local fields="key,summary,status"
    if [[ -n "$sp_field_id" ]]; then
        fields="${fields},${sp_field_id}"
    fi
    local resolution_jql="resolution%20is%20EMPTY"
    if [[ "$show_done" == "true" ]]; then
        resolution_jql="resolution%20is%20not%20EMPTY"
    fi

    local jql="assignee%20%3D%20%27${account_id}%27%20AND%20${resolution_jql}"

    if [[ "$show_all" != "true" ]]; then
        jql="${jql}%20AND%20sprint%20in%20openSprints()"
    fi

    jql="${jql}%20ORDER%20BY%20updated%20DESC"

    curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
         -H "Accept: application/json" \
         "${BASE_URL}/search/jql?jql=${jql}&fields=${fields}"
}

# Function to get a user's account ID by their name or email.
get_account_id_for_user() {
    local assignee_query="$1"
    local encoded_query=$(echo "$assignee_query" | sed 's/ /%20/g')
    local account_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                            -H "Accept: application/json" \
                            "${BASE_URL}/user/search?query=${encoded_query}" | \
                       jq -r '.[0]?.accountId // empty')
    
    if [[ -z "$account_id" ]]; then
        echo "ERROR: Could not find user matching '${assignee_query}'"
    else
        echo "$account_id"
    fi
}

# Function to list open tickets for a given account ID
list_tickets_for_account_id() {
    local account_id="$1"
    local jql="assignee%20%3D%20%27${account_id}%27%20AND%20resolution%20is%20EMPTY%20ORDER%20BY%20updated%20DESC"

    local tickets=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
         -H "Accept: application/json" \
         "${BASE_URL}/search/jql?jql=${jql}&fields=key,summary,status&maxResults=50" | \
    jq -r '(.issues // [])[] | "\(.key): \(.fields.summary): \(.fields.status.name)"')

    if [[ -z "$tickets" ]]; then
        echo "No open tickets found for this user."
    else
        echo "$tickets" | while read -r line; do
            local ticket_id=$(echo "$line" | cut -d: -f1)
            local status=$(echo "$line" | rev | cut -d: -f1 | rev | sed 's/^[[:space:]]*//')
            local title=$(echo "$line" | cut -d: -f2- | rev | cut -d: -f2- | rev | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
            echo "${ticket_id}: ${title} (${status})"
            echo "https://${JIRA_DOMAIN}/browse/${ticket_id}"
            echo
        done
    fi
}

# Function to get current user's open tickets (short format)
get_open_tickets_short() {
    local show_all="$1"
    local sprint_name="$2"
    local assignee_query="$3"
    local jql

    local assignee_jql
    if [[ -n "$assignee_query" ]]; then
        local account_id=$(get_account_id_for_user "$assignee_query")
        if [[ $account_id == ERROR* ]]; then echo "$account_id"; return; fi
        assignee_jql="assignee%20%3D%20%27${account_id}%27"
    else
        assignee_jql="assignee%20in%20(currentUser())"
    fi

    if [[ "$show_all" == "true" ]]; then
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20ORDER%20BY%20updated%20DESC"
    elif [[ -n "$sprint_name" ]]; then
        local encoded_sprint=$(echo "$sprint_name" | sed 's/ /%20/g')
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20AND%20sprint%20%3D%20%22${encoded_sprint}%22%20ORDER%20BY%20updated%20DESC"
    else
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20AND%20sprint%20in%20openSprints()%20ORDER%20BY%20updated%20DESC"
    fi

    curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
         -H "Accept: application/json" \
         "${BASE_URL}/search/jql?jql=${jql}&fields=key,summary&maxResults=50" | \
    jq -r '(.issues // [])[] | "\(.key): \(.fields.summary)"'
}

# Function to get current user's open tickets (full format with status)
get_open_tickets_full() {
    local show_all="$1"
    local sprint_name="$2"
    local assignee_query="$3"
    local jql

    local assignee_jql
    if [[ -n "$assignee_query" ]]; then
        local account_id=$(get_account_id_for_user "$assignee_query")
        if [[ $account_id == ERROR* ]]; then echo "$account_id"; return; fi
        assignee_jql="assignee%20%3D%20%27${account_id}%27"
    else
        assignee_jql="assignee%20in%20(currentUser())"
    fi

    if [[ "$show_all" == "true" ]]; then
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20ORDER%20BY%20updated%20DESC"
    elif [[ -n "$sprint_name" ]]; then
        local encoded_sprint=$(echo "$sprint_name" | sed 's/ /%20/g')
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20AND%20sprint%20%3D%20%22${encoded_sprint}%22%20ORDER%20BY%20updated%20DESC"
    else
        jql="${assignee_jql}%20AND%20resolution%20is%20EMPTY%20AND%20sprint%20in%20openSprints()%20ORDER%20BY%20updated%20DESC"
    fi

    curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
         -H "Accept: application/json" \
         "${BASE_URL}/search/jql?jql=${jql}&fields=key,summary,status&maxResults=50" | \
    jq -r '(.issues // [])[] | "\(.key): \(.fields.summary): \(.fields.status.name)"'
}

# Function to get current user info
get_current_user() {
    curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
         -H "Accept: application/json" \
         "${BASE_URL}/myself" | jq -r '.accountId'
}

# Function to get the active sprint for a project/board
# Returns a JSON object with sprint id and name
get_active_sprint() {
    local project_key="$1"
    local board_id="$2"
    local agile_base_url="https://${JIRA_DOMAIN}/rest/agile/1.0"

    if [[ -z "$project_key" ]]; then
        project_key=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                           -H "Accept: application/json" \
                           "${BASE_URL}/search/jql?jql=assignee%20in%20(currentUser())&fields=project&maxResults=1" | \
                      jq -r '.issues[0]?.fields.project.key // empty')
        if [[ -z "$project_key" ]]; then echo "Error: Could not infer project." >&2; return 1; fi
    fi

    if [[ -z "$board_id" ]]; then
        board_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                        -H "Accept: application/json" \
                        "${agile_base_url}/board?projectKeyOrId=${project_key}" | \
                   jq -r '.values[0]?.id // empty')
        if [[ -z "$board_id" ]]; then echo "Error: Could not find board for project ${project_key}." >&2; return 1; fi
    fi

    local sprint_info=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                             -H "Accept: application/json" \
                             "${agile_base_url}/board/${board_id}/sprint?state=active" | \
                        jq -r '.values[0] | {id, name} | @json')

    if [[ -z "$sprint_info" || "$sprint_info" == "null" ]]; then
        return 1
    fi

    echo "$sprint_info"
}

# Function to create a new ticket
create_ticket() {
    local title="$1"
    local user_id=$(get_current_user)

    if [[ -z "$user_id" ]]; then echo "Error: Could not get current user ID"; exit 1; fi

    # Get active sprint info
    local sprint_info=$(get_active_sprint)
    local sprint_id=$(echo "$sprint_info" | jq -r '.id // empty')
    local sprint_name=$(echo "$sprint_info" | jq -r '.name // empty')
    local sprint_field_id=$(get_sprint_field_id)

    local project_key=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                            -H "Accept: application/json" \
                            "${BASE_URL}/search/jql?jql=assignee%20in%20(currentUser())&fields=project&maxResults=1" | \
                       jq -r '.issues[0]?.fields.project.key // empty')

    if [[ -z "$project_key" ]]; then echo "Error: Could not determine project."; exit 1; fi

    # Start building the fields object
    local issue_data_fields=$(jq -n --arg project "$project_key" --arg summary "$title" --arg assignee "$user_id" \
        '{project: {key: $project}, summary: $summary, issuetype: {name: "Task"}, assignee: {accountId: $assignee}}')

    # Add sprint field if found
    if [[ -n "$sprint_id" && -n "$sprint_field_id" ]]; then
        issue_data_fields=$(echo "$issue_data_fields" | jq --arg field_id "$sprint_field_id" --argjson sprint_id "$sprint_id" \
            '. + {($field_id): $sprint_id}')
    fi

    local issue_data=$(jq -n --argjson fields "$issue_data_fields" '{fields: $fields}')

    local response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d "$issue_data" "${BASE_URL}/issue")

    local ticket_key=$(echo "$response" | jq -r '.key // empty')
    local error=$(echo "$response" | jq -r '.errorMessages[]? // empty')

    if [[ -n "$error" ]]; then
        echo "Error creating ticket: $error"; echo "$response" | jq .; exit 1;
    elif [[ -n "$ticket_key" ]]; then
        echo "Created ticket: $ticket_key"
        echo "Title: $title"
        echo "URL: https://${JIRA_DOMAIN}/browse/${ticket_key}"

        if [[ -n "$sprint_id" ]]; then
            echo "Assigned to sprint: ${sprint_name} (ID: ${sprint_id})"
        else
            echo "Warning: Could not find active sprint to assign."
        fi
    else
        echo "Error: Unexpected response creating ticket"; echo "$response"; exit 1;
    fi
}

# Function to get ticket details
get_ticket_details() {
    local ticket_id="$1"
    local field_query="$2"
    local sp_field_id=$(get_story_points_field_id)
    local jira_domain=${JIRA_DOMAIN:-"kasagilabo.atlassian.net"}

    local response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                        -H "Accept: application/json" \
                        "${BASE_URL}/issue/${ticket_id}?expand=renderedFields")

    if [[ $(echo "$response" | jq -r '.errorMessages // empty') ]]; then
        echo "Error: Ticket ${ticket_id} not found or not accessible"; exit 1;
    fi

    # Create a unified JSON object of the ticket fields for easier processing
    local ticket_data=$(echo "$response" | jq -c --arg sp_field "$sp_field_id" --arg domain "$jira_domain" '
        {
            "ID": .key,
            "Title": .fields.summary,
            "URL": ("https://" + $domain + "/browse/" + .key),
            "Status": .fields.status.name,
            "Assignee": (.fields.assignee.displayName // "Unassigned"),
            "Parent": (.fields.parent.key // ""),
            "Reporter": .fields.reporter.displayName,
            "Story Points": (if $sp_field != "" and .fields[$sp_field] then (.fields[$sp_field] | tostring) else "Not set" end),
            "Description": (.renderedFields.description // "No description found.")
        }
    ')

    # If a specific field is requested, show it and exit
    if [[ -n "$field_query" ]]; then
        local key_to_find=$(echo "$ticket_data" | jq -r --arg query "$field_query" 'keys_unsorted[] | select(test($query; "i"))' | head -n 1)

        if [[ -z "$key_to_find" ]]; then
            echo "Error: Field matching '${field_query}' not found." >&2
            echo "Available fields: $(echo "$ticket_data" | jq -r 'keys_unsorted | join(", ")')" >&2
            return 1
        fi

        local value=$(echo "$ticket_data" | jq -r --arg key "$key_to_find" '.[$key]')

        if [[ "$key_to_find" == "Description" ]]; then
            if command -v pandoc &> /dev/null; then
                echo "$value" | pandoc -f html -t markdown
            else
                echo "$value" | sed -e 's/<[^>]*>//g'
            fi
        else
            echo "$value"
        fi
        return
    fi

    # Otherwise, display the table
    local table_content=$(echo "$ticket_data" | jq -r '
        to_entries[] |
        select(.key != "Description") |
        if .value != "" and .value != null and .value != "Not set" then
            "\(.key):\t\(.value)"
        else
            empty
        end
    ')

    echo "$table_content" | column -t -s $'\t'

    local description_html=$(echo "$ticket_data" | jq -r '.Description')
    if [[ -n "$description_html" && "$description_html" != "No description found." ]]; then
        echo ""
        echo "Description:"
        if command -v pandoc &> /dev/null; then
            echo "$description_html" | pandoc -f html -t markdown
        else
            echo "$description_html" | sed -e 's/<[^>]*>//g'
        fi
    fi
}

# Function to transition a ticket to "Done"
transition_ticket_to_done() {
    local ticket_id="$1"
    local transitions_response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" "${BASE_URL}/issue/${ticket_id}/transitions")
    local done_transition_id=$(echo "$transitions_response" | jq -r '.transitions[]? | select(.to.name == "Done") | .id' | head -n 1)

    if [[ -z "$done_transition_id" ]]; then
        echo "Error: Could not find a transition to 'Done' for ticket ${ticket_id}."; exit 1; fi

    local transition_payload=$(jq -n --arg id "$done_transition_id" '{transition: {id: $id}}')
    local post_response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d "$transition_payload" "${BASE_URL}/issue/${ticket_id}/transitions")

    if [[ "$post_response" == "204" ]]; then
        echo "Ticket ${ticket_id} successfully transitioned to Done."
    else
        echo "Error: Failed to transition ticket ${ticket_id}."; echo "API returned HTTP status: ${post_response}"; exit 1;
    fi
}

# Function to set story points for a ticket
set_story_points() {
    local ticket_id="$1"
    local points="$2"
    local sp_field_id=$(get_story_points_field_id)

    if [[ -z "$sp_field_id" ]]; then
        echo "Error: 'Story Points' field not found in this Jira instance."; exit 1; fi

    if ! [[ "$points" =~ ^[0-9]+$ ]]; then
        echo "Error: Story points must be a non-negative integer."; exit 1; fi

    local payload=$(jq -n --arg field_id "$sp_field_id" --argjson points "$points" '{fields: {($field_id): $points}}')

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" -H "Content-Type: application/json" -X PUT -d "$payload" "${BASE_URL}/issue/${ticket_id}")

    if [[ "$response_code" == "204" ]]; then
        echo "Successfully set Story Points to ${points} for ticket ${ticket_id}."
    else
        echo "Error: Failed to set Story Points for ticket ${ticket_id}."; echo "API returned HTTP status: ${response_code}"; exit 1;
    fi
}

# Function to get story points for a ticket
get_story_points_for_ticket() {
    local ticket_id="$1"
    local sp_field_id=$(get_story_points_field_id)

    if [[ -z "$sp_field_id" ]]; then
        echo "Warning: 'Story Points' field not found in this Jira instance."
        return
    fi

    local response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                        -H "Accept: application/json" \
                        "${BASE_URL}/issue/${ticket_id}")

    if [[ $(echo "$response" | jq -r '.errorMessages // empty') ]]; then
        echo "Error: Ticket ${ticket_id} not found or not accessible"; exit 1;
    fi

    local story_points=$(echo "$response" | jq -r --arg sp_field "$sp_field_id" '.fields[$sp_field] // "Not set"')
    echo "Story Points for ${ticket_id}: ${story_points}"
}

# Function to sum story points for current user in open sprints
sum_story_points_for_current_user() {
    local my_account_id=$(get_current_user)
    local sp_field_id=$(get_story_points_field_id)

    if [[ -z "$sp_field_id" ]]; then
        echo "Warning: 'Story Points' field not found in this Jira instance."
        return
    fi

    # Get open tickets in open sprints
    local open_tickets_json=$(get_sprint_tickets_json_for_account "$my_account_id" "false" "false")
    local open_points=$(echo "$open_tickets_json" | jq --arg sp_field "$sp_field_id" '
        [.issues[] | .fields[$sp_field] | select(. != null)] | add // 0
    ')

    # Get closed tickets in open sprints
    local closed_tickets_json=$(get_sprint_tickets_json_for_account "$my_account_id" "false" "true")
    local closed_points=$(echo "$closed_tickets_json" | jq --arg sp_field "$sp_field_id" '
        [.issues[] | .fields[$sp_field] | select(. != null)] | add // 0
    ')

    local total_points=$((open_points + closed_points))

    echo "Story Point Summary for current user (Open Sprints):"
    echo "  Open:   ${open_points}"
    echo "  Closed: ${closed_points}"
    echo "  Total:  ${total_points}"
}

# Function to assign a ticket to a specific sprint by name
assign_ticket_to_sprint() {
    local ticket_id="$1"
    local sprint_query="$2"
    local agile_base_url="https://${JIRA_DOMAIN}/rest/agile/1.0"

    # First, get project and board from the ticket
    local issue_details=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" "${BASE_URL}/issue/${ticket_id}?fields=project")
    local project_key=$(echo "$issue_details" | jq -r '.fields.project.key // empty')
    if [[ -z "$project_key" ]]; then echo "Error: Could not find project for ticket ${ticket_id}" >&2; return 1; fi

    local board_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                        -H "Accept: application/json" \
                        "${agile_base_url}/board?projectKeyOrId=${project_key}" | \
                   jq -r '.values[0]?.id // empty')
    if [[ -z "$board_id" ]]; then echo "Error: Could not find board for project ${project_key}." >&2; return 1; fi

    # Find all sprints matching the query (case-insensitive substring search)
    local matching_sprints=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                                  -H "Accept: application/json" \
                                  "${agile_base_url}/board/${board_id}/sprint" | \
                             jq -c -r --arg query "$sprint_query" '.values[] | select(.name | test($query; "i"))')

    local num_matches=$(echo "$matching_sprints" | grep -c .)

    if [[ "$num_matches" -eq 0 ]]; then
        echo "Error: Could not find any sprint matching '${sprint_query}' on board ${board_id}."
        return 1
    elif [[ "$num_matches" -gt 1 ]]; then
        echo "Error: Multiple sprints match your query '${sprint_query}'. Please be more specific."
        echo "Matching sprints:"
        echo "$matching_sprints" | jq -r '.name'
        return 1
    fi

    # Exactly one match found
    local sprint_info="$matching_sprints"
    local sprint_id=$(echo "$sprint_info" | jq -r '.id // empty')
    local sprint_name=$(echo "$sprint_info" | jq -r '.name // empty')

    if [[ -z "$sprint_id" ]]; then
        echo "Error: Could not parse sprint details from the match." # Should not happen
        return 1
    fi

    echo "Found sprint: ${sprint_name} (ID: ${sprint_id})"
    echo "Assigning ticket ${ticket_id} to this sprint..."

    local sprint_data=$(jq -n --arg issueKey "$ticket_id" '{issues: [$issueKey]}')
    local sprint_response=$(curl -s -w "\n%{http_code}" -H "Authorization: Basic ${JIRA_AUTH}" -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d "$sprint_data" "${agile_base_url}/sprint/${sprint_id}/issue")
    
    local http_code=$(echo "$sprint_response" | tail -n1)
    local response_body=$(echo "$sprint_response" | sed '$d')

    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo "Successfully assigned ${ticket_id} to sprint ${sprint_name}."
    else
        echo "Error: Failed to assign ticket to sprint. Status: ${http_code}"
        echo "Response: ${response_body}"
        return 1
    fi
}

# Function to list sprints for a project in a table
list_sprints_for_project() {
    local project_key="$1"
    local board_id="$2"
    local agile_base_url="https://${JIRA_DOMAIN}/rest/agile/1.0"

    if [[ -z "$project_key" ]]; then
        project_key=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                           -H "Accept: application/json" \
                           "${BASE_URL}/search/jql?jql=assignee%20in%20(currentUser())&fields=project&maxResults=1" | \
                      jq -r '.issues[0]?.fields.project.key // empty')
        if [[ -z "$project_key" ]]; then echo "Error: Could not infer project." >&2; return 1; fi
    fi

    if [[ -z "$board_id" ]]; then
        board_id=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                        -H "Accept: application/json" \
                        "${agile_base_url}/board?projectKeyOrId=${project_key}" | \
                   jq -r '.values[0]?.id // empty')
        if [[ -z "$board_id" ]]; then echo "Error: Could not find board for project ${project_key}." >&2; return 1; fi
    fi

    # Get active and future sprints
    local sprints_json=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                             -H "Accept: application/json" \
                             "${agile_base_url}/board/${board_id}/sprint?state=active,future")

    if [[ -z "$sprints_json" || "$(echo "$sprints_json" | jq -r '.values | length')" == "0" ]]; then
        echo "No active or future sprints found for board ${board_id}."
        return
    fi

    local table_data=$(echo "$sprints_json" | jq -r '
        .values[] |
        (.id | tostring) + "\t" + .name + "\t" + (if .state == "active" then "Yes" else "No" end)'
    )

    (
        echo -e "Id\tSprint\tActive"
        echo -e "--\t------\t------"
        echo "$table_data"
    ) | column -t -s $'\t'
}

# Function to handle sprint command
handle_sprint_command() {
    local ticket_id="$1"
    local sprint_query="$2"

    if [[ -z "$ticket_id" ]]; then
        # List sprints for the project
        # TODO: Add proper arg parsing for --project and --board
        list_sprints_for_project
    elif [[ -n "$ticket_id" && -n "$sprint_query" ]]; then
        # Usage: sprint <ticket_id> <sprint_name_regex>
        assign_ticket_to_sprint "${ticket_id^^}" "$sprint_query"
    else
        show_help
        exit 1
    fi
}

# Function to handle story points command
handle_story_points() {
    local ticket_id="$1"
    local points="$2"

    if [[ -z "$ticket_id" ]]; then
        # sp with no args: sum points for current user in open sprints
        sum_story_points_for_current_user
    elif [[ -n "$ticket_id" && -z "$points" ]]; then
        # sp <ticket>: show points for a ticket
        get_story_points_for_ticket "${ticket_id^^}"
    elif [[ -n "$ticket_id" && -n "$points" ]]; then
        # sp <ticket> <points>: set points for a ticket
        set_story_points "${ticket_id^^}" "$points"
    else
        show_help
        exit 1
    fi
}

# Function to list assignable users for a project
list_assignees() {
    local project_key="$1"

    if [[ -z "$project_key" ]]; then
        echo "No project key provided, attempting to infer from your recent tickets..."
        project_key=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                           -H "Accept: application/json" \
                           "${BASE_URL}/search/jql?jql=assignee%20in%20(currentUser())&fields=project&maxResults=1" | \
                      jq -r '.issues[0]?.fields.project.key // empty')

        if [[ -z "$project_key" ]]; then
            echo "Error: Could not infer project. Please specify a project key."; exit 1; fi
        echo "Found project: ${project_key}"
        echo
    fi

    local response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                          -H "Accept: application/json" \
                          "${BASE_URL}/user/assignable/search?project=${project_key}")

    if [[ $(echo "$response" | head -c 1) == "{" ]]; then
        local error_msg=$(echo "$response" | jq -r '.errorMessages[]? // empty')
        if [[ -n "$error_msg" ]]; then
            echo "Error: Could not retrieve assignees for project '${project_key}'."; echo "API returned: $error_msg"; exit 1; fi
    fi

    echo "Assignable users for project '${project_key}':"
    local table_data=$(echo "$response" | jq -r '.[] | "\(.displayName)\t\(.accountId)"')
    (echo -e "Display Name\tAccount ID"; echo -e "------------\t----------"; echo "$table_data") | column -t -s $'	'
}

# Function to assign a ticket to a user
assign_ticket() {
    local ticket_id="$1"
    local assignee_query="$2"

    local project_key=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                           -H "Accept: application/json" \
                           "${BASE_URL}/issue/${ticket_id}?fields=project" | \
                      jq -r '.fields.project.key // empty')

    if [[ -z "$project_key" ]]; then
        echo "Error: Could not determine project for ticket ${ticket_id}."; exit 1; fi

    echo "Searching for assignable user '${assignee_query}' in project ${project_key}..."
    local user_response=$(curl -s -H "Authorization: Basic ${JIRA_AUTH}" \
                               -H "Accept: application/json" \
                               "${BASE_URL}/user/assignable/search?project=${project_key}")

    local account_id=$(echo "$user_response" | jq -r --arg query "$assignee_query" '.[] | select(.displayName | test($query; "i")) | .accountId' | head -n 1)

    if [[ -z "$account_id" ]]; then
        echo "Error: Could not find assignable user matching '${assignee_query}' for project ${project_key}."; exit 1; fi

    echo "Found user with account ID: ${account_id}"

    local payload=$(jq -n --arg id "$account_id" '{fields: {assignee: {accountId: $id}}}')

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic ${JIRA_AUTH}" \
                               -H "Accept: application/json" \
                               -H "Content-Type: application/json" \
                               -X PUT \
                               -d "$payload" \
                               "${BASE_URL}/issue/${ticket_id}")

    if [[ "$response_code" == "204" ]]; then
        echo "Successfully assigned ticket ${ticket_id} to '${assignee_query}'."
    else
        echo "Error: Failed to assign ticket ${ticket_id}."; echo "API returned HTTP status: ${response_code}"; exit 1;
    fi
}

# Function to list tickets
list_tickets() {
    local assignee_name=""
    local show_all=false
    local show_short=false
    local show_table=false
    local show_done=false

    # Argument parsing with support for combined short flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --short) show_short=true; shift ;;
            --table) show_table=true; shift ;;
            --all) show_all=true; shift ;;
            --done) show_done=true; shift ;;
            -*)
                if [[ "$1" == --* ]]; then
                    echo "Unknown flag: $1"
                    show_help
                    exit 1
                fi
                # Handle single and combined short flags
                local flags="${1:1}"
                for (( i=0; i<${#flags}; i++ )); do
                    case "${flags:$i:1}" in
                        s) show_short=true ;;
                        t) show_table=true ;;
                        a) show_all=true ;;
                        d) show_done=true ;;
                        *) echo "Unknown flag: -${flags:$i:1}"; show_help; exit 1 ;;
                    esac
                done
                shift
                ;;
            *)
                if [[ -z "$assignee_name" ]]; then
                    assignee_name="$1"
                fi
                shift
                ;;
        esac
    done

    local raw_json=""
    if [[ -n "$assignee_name" ]]; then
        local account_id=$(get_account_id_for_user "$assignee_name")
        if [[ $account_id == ERROR* ]]; then echo "$account_id"; exit 1; fi
        raw_json=$(get_sprint_tickets_json_for_account "$account_id" "$show_all" "$show_done")
    else
        local my_account_id=$(get_current_user)
        raw_json=$(get_sprint_tickets_json_for_account "$my_account_id" "$show_all" "$show_done")
    fi

    local issues=$(echo "$raw_json" | jq -r '.issues[] | @base64')

    if [[ -z "$issues" ]]; then
        echo "No open tickets found."
        exit 0
    fi

    local sp_field_id=$(get_story_points_field_id)

    if [[ "$show_short" == "true" ]]; then
        for issue in $issues; do
            echo "$issue" | base64 --decode | jq -r '"\(.key): \(.fields.summary)"'
        done
    elif [[ "$show_table" == "true" ]]; then
        (
            echo "ID|Title|Points|Status"
            echo "--|-----|------|------"
            for issue in $issues; do
                echo "$issue" | base64 --decode | jq -r --arg sp_field "$sp_field_id" '
                    .key + "|" +
                    .fields.summary + "|" +
                    (if .fields[$sp_field] then (.fields[$sp_field] | tostring) else "N/A" end) + "|" +
                    .fields.status.name
                '
            done
        ) | column -t -s '|'
    else
        for issue in $issues; do
            local issue_json=$(echo "$issue" | base64 --decode)
            local ticket_id=$(echo "$issue_json" | jq -r '.key')
            local title=$(echo "$issue_json" | jq -r '.fields.summary')
            local status=$(echo "$issue_json" | jq -r '.fields.status.name')
            local story_points=$(echo "$issue_json" | jq -r --arg sp_field "$sp_field_id" '.fields[$sp_field] // "Not set"')

            echo "${ticket_id}: ${title}"
            echo "${status} - ${story_points}"
            echo "https://${JIRA_DOMAIN}/browse/${ticket_id}"
            echo
        done
    fi
}

# Function to show help message
show_help() {
    echo "Jira CLI Tool"
    echo ""
    echo "Usage: jira <command> [options]"
    echo ""
    echo "Required environment variables:"
    echo "  JIRA_AUTH   - Base64 encoded basic auth (email:api_token)"
    echo "  JIRA_DOMAIN - Your Jira domain (e.g., yourcompany.atlassian.net)"
    echo ""
    echo "Commands:"
    echo "  list (l) [user] [--flags]  List tickets. Defaults to you."
    echo "    Aliases: ls (--short), la (--all), lt (--table)"
    echo "    --short, -s              List tickets in a compact, single-line format."
    echo "    --table, -t              List tickets in a table format."
    echo "    --all, -a                List all tickets (not just from open sprints)."
    echo "    --done, -d               List resolved tickets instead of open ones."
    echo ""
    echo "  get (g) <ticket-id> [field]  Show details for a ticket, or just a specific field."
    echo ""
    echo "  create (c) \"Ticket Title\"  Create a new ticket assigned to you."
    echo ""
    echo "  done (d) <ticket-id>       Transition a ticket to the 'Done' status."
    echo ""
    echo "  sp                         Summarize story points for your tickets in open sprints (open vs closed)."
    echo "  sp <ticket-id>             Show Story Points for a ticket."
    echo "  sp <ticket-id> <points>    Set the Story Points for a ticket."
    echo ""
    echo "  sprint (s)                   Show the current active sprint."
    echo "  sprint (s) <ticket> <query>    Assign a ticket to a sprint matching the query."
    echo ""
    echo "  assign (a) <ticket> <user> Assign a ticket to a user (name or email)."
    echo ""
    echo "  assignees [project-key]    List assignable users for a project."
    echo ""
    echo "  assignee <name|email>      Look up a user's account ID."
    echo ""
    echo "  help (h)                   Show this help message."
}

# Main command dispatcher
main() {
    local command="$1"
    if [[ -z "$command" ]]; then show_help; exit 0; fi
    shift

    case "$command" in
        list|l) list_tickets "$@" ;;
        ls) list_tickets --short "$@" ;;
        la) list_tickets --all "$@" ;;
        lt) list_tickets --table "$@" ;;
        get|g) 
            if [[ -z "$1" ]]; then echo "Error: 'get' requires a ticket ID."; exit 1; fi
            get_ticket_details "${1^^}" "$2" ;; 
        create|c) 
            if [[ -z "$1" ]]; then echo "Error: 'create' requires a ticket title."; exit 1; fi
            create_ticket "$1" ;; 
        done|d) 
            if [[ -z "$1" ]]; then echo "Error: 'done' requires a ticket ID."; exit 1; fi
            transition_ticket_to_done "${1^^}" ;; 
        sp) 
            handle_story_points "$@" ;;
        sprint|s)
            handle_sprint_command "$@" ;;
        assign|a) 
            if [[ -z "$1" || -z "$2" ]]; then echo "Error: 'assign' requires a ticket ID and user."; exit 1; fi
            assign_ticket "${1^^}" "$2" ;; 
                assignees)
                    list_assignees "$1" ;;
                assignee)
                    if [[ -z "$1" ]]; then echo "Error: 'assignee' requires a user name."; exit 1; fi
                    get_account_id_for_user "$1" ;;
                help|--help|-h|h) show_help ;;        *) echo "Unknown command: $command"; show_help; exit 1 ;; 
    esac
}

main "$@"
