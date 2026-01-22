module zendesk

import "resolver.js" @as zdr

entity TicketComment {
    id Number @optional,
    ticket_id Number @optional,
    author_id Number @optional,
    body String @optional,
    public Boolean @optional,
    created_at String @optional
}

entity Ticket {
    id Number @optional,
    subject String @optional,
    description String @optional,
    status String @optional,
    priority String @optional,
    type String @optional,
    requester_id Number @optional,
    assignee_id Number @optional,
    organization_id Number @optional,
    tags String @optional,
    comment TicketComment @optional,
    created_at String @optional,
    updated_at String @optional
}


entity User {
    id Number @optional,
    name String @optional,
    email String @optional,
    role String @optional,
    time_zone String @optional,
    locale String @optional,
    organization_id Number @optional,
    active Boolean @optional,
    created_at String @optional,
    updated_at String @optional
}

entity Organization {
    id Number @optional,
    name String @optional,
    details String @optional,
    notes String @optional,
    group_id Number @optional,
    shared_tickets Boolean @optional,
    shared_comments Boolean @optional,
    created_at String @optional,
    updated_at String @optional
}

entity Category {
    id Number @optional,
    name String @optional,
    description String @optional,
    position Number @optional,
    locale String @optional,
    created_at String @optional,
    updated_at String @optional
}

entity Section {
    id Number @optional,
    name String @optional,
    description String @optional,
    category_id Number @optional,
    position Number @optional,
    locale String @optional,
    created_at String @optional,
    updated_at String @optional
}

entity Article {
    id Number @optional,
    title String @optional,
    body String @optional,
    locale String @default("en-us"),
    section_id Number @optional,
    author_id Number @optional,
    user_segment_id Number @optional,
    permission_group_id Number @optional,
    comments_disabled Boolean @optional,
    draft Boolean @optional,
    promoted Boolean @optional,
    created_at String @optional,
    updated_at String @optional
}

entity UserSegment {
    id Number @optional,
    name String @optional,
    user_type String @optional,
    group_ids String @optional,
    organization_ids String @optional,
    tags String @optional,
    or_tags String @optional,
    added_user_ids String @optional,
    built_in Boolean @optional,
    created_at String @optional,
    updated_at String @optional
}

entity PermissionGroup {
    id Number @optional,
    name String @optional,
    publish String @optional,
    edit String @optional,
    built_in Boolean @optional,
    created_at String @optional,
    updated_at String @optional
}

resolver zendeskTicket [zendesk/Ticket] {
    create zdr.createTicket,
    query zdr.queryTicket,
    update zdr.updateTicket,
    delete zdr.deleteTicket,
    subscribe zdr.subsTickets
}

resolver zendeskTicketComment [zendesk/TicketComment] {
    query zdr.queryTicketComments,
    update zdr.addTicketComment
}

resolver zendeskUser [zendesk/User] {
    create zdr.createUser,
    query zdr.queryUser,
    update zdr.updateUser,
    delete zdr.deleteUser
}

resolver zendeskOrganization [zendesk/Organization] {
    create zdr.createOrganization,
    query zdr.queryOrganization,
    update zdr.updateOrganization,
    delete zdr.deleteOrganization
}

resolver zendeskCategory [zendesk/Category] {
    create zdr.createCategory,
    query zdr.queryCategory,
    update zdr.updateCategory,
    delete zdr.deleteCategory
}

resolver zendeskSection [zendesk/Section] {
    create zdr.createSection,
    query zdr.querySection,
    update zdr.updateSection,
    delete zdr.deleteSection
}

resolver zendeskArticle [zendesk/Article] {
    create zdr.createArticle,
    query zdr.queryArticle,
    update zdr.updateArticle,
    delete zdr.deleteArticle
}

resolver zendeskUserSegment [zendesk/UserSegment] {
    query zdr.queryUserSegment
}

resolver zendeskPermissionGroup [zendesk/PermissionGroup] {
    create zdr.createPermissionGroup,
    query zdr.queryPermissionGroup,
    update zdr.updatePermissionGroup,
    delete zdr.deletePermissionGroup
}

agent zendeskAgent {
    llm "ticketflow_llm",
    role "You manage Zendesk support tickets.",
    instruction "You can create, query, update, delete, and subscribe to Zendesk tickets, manage ticket comments, users, organizations, Help Center categories/sections/articles, user segments, and permission groups. Use the appropriate resolver and include IDs for updates or deletions.",
    tools [zendesk/Ticket, zendesk/TicketComment, zendesk/User, zendesk/Organization, zendesk/Category, zendesk/Section, zendesk/Article, zendesk/UserSegment, zendesk/PermissionGroup]
}
