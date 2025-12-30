module freshdesk

import "resolver.js" @as fr

entity Ticket {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    subject String @optional,
    description String @optional,
    status String @optional,
    priority String @optional,
    type String @optional,
    source String @optional,
    requester_id String @optional,
    responder_id String @optional,
    group_id String @optional,
    company_id String @optional,
    tags String @optional,
    url String @optional,
    web_url String @optional
}

entity Contact {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    name String @optional,
    email String @optional,
    phone String @optional,
    mobile String @optional,
    company_id String @optional,
    job_title String @optional,
    active Boolean @optional,
    address String @optional
}

entity Agent {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    email String @optional,
    name String @optional,
    active Boolean @optional,
    job_title String @optional,
    phone String @optional,
    mobile String @optional,
    time_zone String @optional,
    role String @optional
}

entity Company {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    name String @optional,
    description String @optional,
    note String @optional,
    domains String @optional,
    industry String @optional,
    custom_fields Map @optional
}

entity Group {
    id String @id,
    created_at String @optional,
    updated_at String @optional,
    name String @optional,
    description String @optional,
    agent_ids String @optional
}

entity CreateTicketInput {
    subject String @optional,
    description String @optional,
    email String @optional,
    priority String @optional,
    status String @optional,
    type String @optional,
    tags String @optional,
    group_id String @optional,
    responder_id String @optional,
    company_id String @optional
}

entity CreateTicketOutput {
    id String @optional,
    subject String @optional,
    status String @optional,
    url String @optional
}

entity CreateContactInput {
    name String @optional,
    email String @optional,
    phone String @optional,
    mobile String @optional,
    company_id String @optional,
    job_title String @optional,
    address String @optional
}

entity CreateContactOutput {
    id String @optional,
    name String @optional,
    email String @optional,
    url String @optional
}

entity FreshdeskMetadata {
    domain String @optional,
    api_key String @optional,
    base_url String @optional
}

resolver freshdesk1 [freshdesk/Ticket] {
    create fr.createTicket,
    query fr.queryTicket,
    update fr.updateTicket,
    delete fr.deleteTicket,
    subscribe fr.subsTickets
}

resolver freshdesk2 [freshdesk/Contact] {
    create fr.createContact,
    query fr.queryContact,
    update fr.updateContact,
    delete fr.deleteContact,
    subscribe fr.subsContacts
}

resolver freshdesk3 [freshdesk/Agent] {
    query fr.queryAgent,
    subscribe fr.subsAgents
}

resolver freshdesk4 [freshdesk/Company] {
    create fr.createCompany,
    query fr.queryCompany,
    update fr.updateCompany,
    delete fr.deleteCompany,
    subscribe fr.subsCompanies
}

resolver freshdesk5 [freshdesk/Group] {
    query fr.queryGroup,
    subscribe fr.subsGroups
}

resolver freshdesk6 [freshdesk/CreateTicketInput] {
    create fr.createTicketAction
}

resolver freshdesk7 [freshdesk/CreateTicketOutput] {
    query fr.queryCreateTicket
}

resolver freshdesk8 [freshdesk/CreateContactInput] {
    create fr.createContactAction
}

resolver freshdesk9 [freshdesk/CreateContactOutput] {
    query fr.queryCreateContact
}

