module expensify

import "resolver.js" @as efr

entity Expense {
    id String @optional,
    report_id String @optional,
    report_name String @optional,
    merchant String @optional,
    amount Number @optional,
    currency String @optional,
    category String @optional,
    created String @optional,
    modified String @optional,
    comment String @optional,
    receipt Boolean @optional,
    reimbursable Boolean @optional,
    billable Boolean @optional,
    expense_type String @optional,
    tag String @optional,
    employee_email String @optional,
    employee_name String @optional
}

entity Report {
    id String @optional,
    report_name String @optional,
    status String @optional,
    total Number @optional,
    currency String @optional,
    created String @optional,
    modified String @optional,
    submitted String @optional,
    approved String @optional,
    reimbursed String @optional,
    employee_email String @optional,
    employee_name String @optional,
    policy_id String @optional,
    policy_name String @optional,
    expense_count Number @optional
}

entity Policy {
    id String @optional,
    name String @optional,
    output_currency String @optional,
    created String @optional,
    modified String @optional,
    employee_count Number @optional,
    owner_email String @optional
}

resolver expensify1 [expensify/Expense] {
    create efr.createExpense,
    query efr.queryExpense,
    update efr.updateExpense,
    delete efr.deleteExpense,
    subscribe efr.subsExpenses
}

resolver expensify2 [expensify/Report] {
    create efr.createReport,
    query efr.queryReport,
    update efr.updateReport,
    delete efr.deleteReport,
    subscribe efr.subsReports
}

resolver expensify3 [expensify/Policy] {
    create efr.createPolicy,
    query efr.queryPolicy,
    update efr.updatePolicy,
    delete efr.deletePolicy,
    subscribe efr.subsPolicies
}

agent expensifyAgent {
    role "You are an app responsible for managing Expensify expense data including expenses, reports, and policies."
    instruction "You are an app responsible for managing Expensify expense data. You can create, read, update, and delete:
                    - Expenses: Individual expense items with merchant, amount, category, and receipt information
                    - Reports: Expense reports that contain multiple expenses and track approval status
                    - Policies: Company expense policies that define rules and settings
                    
                    Use the appropriate tool based on the entity type and operation requested. 
                    For queries, you can search by ID or retrieve all records.
                    For updates, provide the entity ID and the fields to update.
                    For deletions, provide the entity ID to remove.",
    tools [expensify/Expense, expensify/Report, expensify/Policy]
}

