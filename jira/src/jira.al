module jira

import "resolver.js" @as jr

entity Author {
    account_id String @optional,
    active Boolean @optional,
    display_name String @optional,
    email_address String @optional
}

entity Comment {
    id String @optional,
    created_at String @optional,
    updated_at String @optional,
    author Author @optional,
    body String @optional
}

entity Issue {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    key String @optional,
    summary String @optional,
    issue_type String @optional,
    status String @optional,
    assignee String @optional,
    url String @optional,
    web_url String @optional,
    project_id String @optional,
    project_key String @optional,
    project_name String @optional,
    comments Comment @optional
}

entity Project {
    id String @id,
    key String @optional,
    name String @optional,
    url String @optional,
    project_type_key String @optional,
    web_url String @optional
}

entity IssueType {
    project_id String @optional,
    id String @id,
    name String @optional,
    description String @optional,
    url String @optional
}

entity CreateIssueInput {
    summary String @optional,
    description String @optional,
    assignee String @optional,
    labels String @optional,
    project String @optional,
    issue_type String @optional
}

entity CreateIssueOutput {
    id String @optional,
    key String @optional,
    self String @optional
}

entity JiraMetadata {
    project_ids_to_sync String @optional,
    cloud_id String @optional,
    base_url String @optional,
    time_zone String @optional
}

entity User {
    account_id String @id,
    display_name String @optional,
    email_address String @optional,
    active Boolean @optional,
    time_zone String @optional
}

entity Status {
    id String @id,
    name String @optional,
    description String @optional,
    status_category String @optional
}

resolver jira1 [jira/Issue] {
    create jr.createIssue,
    query jr.queryIssue,
    update jr.updateIssue,
    delete jr.deleteIssue,
    subscribe jr.subsIssues
}

resolver jira2 [jira/Project] {
    create jr.createProject,
    query jr.queryProject,
    update jr.updateProject,
    delete jr.deleteProject,
    subscribe jr.subsProjects
}

resolver jira3 [jira/IssueType] {
    query jr.queryIssueType,
    subscribe jr.subsIssueTypes
}

resolver jira4 [jira/CreateIssueInput] {
    create jr.createIssueAction
}

resolver jira5 [jira/CreateIssueOutput] {
    query jr.queryCreateIssue
}

resolver jira6 [jira/User] {
    query jr.queryUser
}

resolver jira7 [jira/Status] {
    query jr.queryStatus
}