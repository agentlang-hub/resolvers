module zoho

import "resolver.js" @as zcr

entity Lead {
    id String @optional,
    first_name String @optional,
    last_name String @optional,
    email String @optional,
    company String @optional,
    phone String @optional,
    mobile String @optional,
    lead_source String @optional,
    lead_status String @optional,
    owner String @optional,
    description String @optional,
    created_time String @optional,
    modified_time String @optional
}

entity Contact {
    id String @optional,
    first_name String @optional,
    last_name String @optional,
    email String @optional,
    phone String @optional,
    mobile String @optional,
    account_id String @optional,
    title String @optional,
    department String @optional,
    owner String @optional,
    created_time String @optional,
    modified_time String @optional
}

entity Account {
    id String @optional,
    account_name String @optional,
    website String @optional,
    phone String @optional,
    industry String @optional,
    billing_city String @optional,
    billing_state String @optional,
    billing_country String @optional,
    owner String @optional,
    description String @optional,
    created_time String @optional,
    modified_time String @optional
}

entity Deal {
    id String @optional,
    deal_name String @optional,
    stage String @optional,
    amount Number @optional,
    closing_date String @optional,
    pipeline String @optional,
    account_id String @optional,
    contact_id String @optional,
    probability Number @optional,
    description String @optional,
    owner String @optional,
    created_time String @optional,
    modified_time String @optional
}

entity Task {
    id String @optional,
    subject String @optional,
    status String @optional,
    priority String @optional,
    due_date String @optional,
    what_id String @optional,
    who_id String @optional,
    owner String @optional,
    description String @optional,
    created_time String @optional,
    modified_time String @optional
}

entity Note {
    id String @optional,
    note_title String @optional,
    note_content String @optional,
    parent_id String @optional,
    owner String @optional,
    created_time String @optional,
    modified_time String @optional
}

resolver zohoLead [zoho/Lead] {
    create zcr.createLead,
    query zcr.queryLead,
    update zcr.updateLead,
    delete zcr.deleteLead,
    subscribe zcr.subsLead
}

resolver zohoContact [zoho/Contact] {
    create zcr.createContact,
    query zcr.queryContact,
    update zcr.updateContact,
    delete zcr.deleteContact
}

resolver zohoAccount [zoho/Account] {
    create zcr.createAccount,
    query zcr.queryAccount,
    update zcr.updateAccount,
    delete zcr.deleteAccount
}

resolver zohoDeal [zoho/Deal] {
    create zcr.createDeal,
    query zcr.queryDeal,
    update zcr.updateDeal,
    delete zcr.deleteDeal
}

resolver zohoTask [zoho/Task] {
    create zcr.createTask,
    query zcr.queryTask,
    update zcr.updateTask,
    delete zcr.deleteTask
}

resolver zohoNote [zoho/Note] {
    create zcr.createNote,
    query zcr.queryNote,
    update zcr.updateNote,
    delete zcr.deleteNote
}
