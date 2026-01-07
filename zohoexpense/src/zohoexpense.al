module zohoexpense

import "resolver.js" @as zexp

entity Expense {
    id String @optional,
    report_id String @optional,
    amount Number @optional,
    currency String @optional,
    description String @optional,
    status String @optional,
    created_time String @optional,
    updated_time String @optional,
    merchant String @optional,
    category String @optional,
    currency_id String @optional,
    category_id String @optional
}

entity Report {
    id String @optional,
    name String @optional,
    status String @optional,
    total Number @optional,
    currency String @optional,
    submitted_time String @optional,
    approved_time String @optional,
    last_modified_time String @optional,
    owner String @optional
}

resolver zohoexpense1 [zohoexpense/Expense] {
    create zexp.createExpense,
    query zexp.queryExpense
}

resolver zohoexpense2 [zohoexpense/Report] {
    query zexp.queryReport
}

entity Currency {
    id String @optional,
    code String @optional,
    name String @optional,
    symbol String @optional,
    is_base Boolean @optional,
    exchange_rate Number @optional
}

entity ExpenseCategory {
    id String @optional,
    name String @optional,
    parent_id String @optional,
    status String @optional,
    is_active Boolean @optional,
    type String @optional
}

resolver zohoexpense3 [zohoexpense/Currency] {
    query zexp.queryCurrency
}

resolver zohoexpense4 [zohoexpense/ExpenseCategory] {
    query zexp.queryExpenseCategory
}

