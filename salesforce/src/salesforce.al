module salesforce

import "resolver.js" @as sfr

entity Contact {
    id String @optional,
    first_name String @optional,
    last_name String @optional,
    account_name String @optional,
    account_id String @optional,
    email String @optional,
    owner_id String @optional,
    owner_name String @optional,
    mobile String @optional,
    phone String @optional,
    salutation String @optional,
    title String @optional,
    last_modified_date String @optional
}

entity Lead {
    id String @optional,
    first_name String @optional,
    last_name String @optional,
    company_name String @optional,
    email String @optional,
    owner_id String @optional,
    owner_name String @optional,
    phone String @optional,
    salutation String @optional,
    title String @optional,
    website String @optional,
    industry String @optional,
    last_modified_date String @optional
}

entity Account {
    id String @optional,
    name String @optional,
    description String @optional,
    website String @optional,
    industry String @optional,
    billing_city String @optional,
    billing_country String @optional,
    owner_id String @optional,
    owner_name String @optional,
    last_modified_date String @optional
}

entity Opportunity {
    id String @optional,
    opportunity_name String @optional,
    account_name String @optional,
    account_id String @optional,
    amount Number @optional,
    description String @optional,
    close_date String @optional,
    created_by_id String @optional,
    created_by String @optional,
    owner_id String @optional,
    owner_name String @optional,
    stage String @optional,
    probability Number @optional,
    type String @optional,
    last_modified_date String @optional
}

entity Ticket {
    id String @optional,
    case_number String @optional,
    subject String @optional,
    account_id String @optional,
    account_name String @optional,
    contact_id String @optional,
    contact_name String @optional,
    owner_id String @optional,
    owner_name String @optional,
    priority String @optional,
    status String @optional,
    description String @optional,
    type String @optional,
    created_date String @optional,
    closed_date String @optional,
    origin String @optional,
    is_closed Boolean @optional,
    is_escalated Boolean @optional,
    last_modified_date String @optional
}

entity Article {
    id String @optional,
    title String @optional,
    content String @optional,
    last_modified_date String @optional
}

resolver salesforce1 [salesforce/Contact] {
    create sfr.createContact,
    query sfr.queryContact,
    update sfr.updateContact,
    delete sfr.deleteContact,
    subscribe sfr.subsContacts
}

resolver salesforce2 [salesforce/Lead] {
    create sfr.createLead,
    query sfr.queryLead,
    update sfr.updateLead,
    delete sfr.deleteLead,
    subscribe sfr.subsLeads
}

resolver salesforce3 [salesforce/Account] {
    create sfr.createAccount,
    query sfr.queryAccount,
    update sfr.updateAccount,
    delete sfr.deleteAccount,
    subscribe sfr.subsAccounts
}

resolver salesforce4 [salesforce/Opportunity] {
    create sfr.createOpportunity,
    query sfr.queryOpportunity,
    update sfr.updateOpportunity,
    delete sfr.deleteOpportunity,
    subscribe sfr.subsOpportunities
}

resolver salesforce5 [salesforce/Ticket] {
    create sfr.createTicket,
    query sfr.queryTicket,
    update sfr.updateTicket,
    delete sfr.deleteTicket,
    subscribe sfr.subsTickets
}

resolver salesforce6 [salesforce/Article] {
    create sfr.createArticle,
    query sfr.queryArticle,
    update sfr.updateArticle,
    delete sfr.deleteArticle,
    subscribe sfr.subsArticles
}

agent salesforceAgent {
    llm "ticketflow_llm",
    role "You are an app responsible for managing Salesforce CRM data including contacts, leads, accounts, opportunities, tickets, and articles."
    instruction "You are an app responsible for managing Salesforce CRM data. You can create, read, update, and delete:
                    - Contacts: Customer contact information and details
                    - Leads: Potential customer information and prospects
                    - Accounts: Business account information and organizations
                    - Opportunities: Sales opportunities and pipeline management
                    - Tickets: Support cases and customer service tickets
                    - Articles: Knowledge base articles and documentation
                    
                    Use the appropriate tool based on the entity type and operation requested. 
                    For queries, you can search by ID or retrieve all records.
                    For updates, provide the entity ID and the fields to update.
                    For deletions, provide the entity ID to remove.",
    tools [salesforce/Contact, salesforce/Lead, salesforce/Account, salesforce/Opportunity, salesforce/Ticket, salesforce/Article]
}
